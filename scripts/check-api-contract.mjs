#!/usr/bin/env node
/**
 * Verifies every endpoint pocket calls still exists on the Aurral version we
 * target, and that the responses pocket reads still have the shape it expects.
 *
 * Aurral 2.0 moved the weekly-flow router to /playlists and deleted
 * /search/artists. Both were silent: the client kept compiling, and the failure
 * only showed up as a runtime 404 on a user's device. This check turns that
 * class of drift into a red build.
 *
 * How it decides a route is missing
 * ---------------------------------
 * Aurral answers any unmatched /api/* path from a catch-all that returns
 * exactly `{"error":"Not found"}` (backend/server.js). Every real route
 * produces something else — 200, 400 for a bad parameter, 401/403, even 500 —
 * so the check keys off that body rather than the status code. That is what
 * makes synthetic path parameters safe: `/library/artists/<uuid>` answers
 * "Artist not found", which is a route that exists reporting an absent record.
 *
 * Authentication is required, not optional. Routers that apply `requireAuth` at
 * the router level (weeklyFlow) answer 401 for unmatched paths too, which would
 * make every missing route under /playlists look present.
 *
 * How it decides a response shape drifted
 * ---------------------------------------
 * Route existence alone missed #176: Aurral cc9dc1d5 removed the `jobs` array
 * from GET /playlists/status, the route kept answering 200, and the flow
 * detail sheet shipped with an empty track list. So for every GET route that
 * answers 200 with JSON, the check records the body's *shape* — key paths and
 * value types, never values — and compares it against the checked-in baseline
 * in scripts/api-contract-baseline.json.
 *
 * The baseline is tied to the pinned version in .aurral-version. Bumping the
 * pin without regenerating the baseline fails the build, so upstream shape
 * drift lands in the same PR as the bump, as a reviewable diff.
 *
 * A key that disappears or changes type fails the build, with two deliberate
 * tolerances: a key that *appears* is only reported (additions cannot break a
 * reader), and "null" matches any type (fresh-install nullables track timing
 * and provider reachability, not the contract). Parameterized GET routes are
 * excluded — probed with synthetic IDs, their bodies describe nonexistent
 * records — so shape checking covers the routes that answer 200 without real
 * data: status, settings, lists.
 *
 * Usage:
 *   AURRAL_URL=http://localhost:3001 node scripts/check-api-contract.mjs
 *
 * Regenerating the baseline (after bumping .aurral-version, or after adding a
 * GET call site) — record against a fresh, onboarded container of the pinned
 * version, exactly like .github/workflows/api-contract.yml starts one:
 *   docker run -d --name aurral -p 3001:3001 ghcr.io/lklynet/aurral:$(cat .aurral-version)
 *   curl -X POST http://localhost:3001/api/onboarding/complete ...   # see workflow
 *   AURRAL_URL=http://localhost:3001 node scripts/check-api-contract.mjs --record
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(ROOT, "lib", "api");
const BASELINE_PATH = join(ROOT, "scripts", "api-contract-baseline.json");
const PINNED_VERSION = readFileSync(
  join(ROOT, ".aurral-version"),
  "utf8",
).trim();
const RECORD = process.argv.includes("--record");
const BASE = (process.env.AURRAL_URL || "http://localhost:3001").replace(
  /\/+$/,
  "",
);
const USERNAME = process.env.AURRAL_USER || "ci";
const PASSWORD = process.env.AURRAL_PASSWORD || "Ci-Contract-Check-2026!";
const CATCH_ALL = "Not found";

// Stand-ins for path parameters. A route that exists will reject these on their
// merits; only a route that does not exist hits the catch-all.
const SYNTHETIC = {
  uuid: "00000000-0000-0000-0000-000000000000",
  id: "1",
};

/**
 * Probed last, for two reasons:
 *   /auth/logout ends the session we authenticated with. Left in file order it
 *   sorts near the front, every later route answers 401, and 401 reads as
 *   "route exists" — the check passes while completely blind.
 *   /auth/login sits behind Aurral's auth rate limiter (10 requests per 15
 *   minutes), and spending that budget early can starve the re-auth retry.
 */
const PROBE_LAST = new Set(["/auth/logout", "/auth/login"]);

/** Re-auth budget, kept well under the server's 10-per-15-minutes. */
const MAX_RELOGINS = 2;

/**
 * Drift we already know about and have not fixed yet. Listed here so the build
 * still fails on anything *new*; delete an entry when its issue closes.
 *
 * Keep this list short. Every entry is a call pocket makes that 404s in
 * production.
 */
const KNOWN_DRIFT = new Map([]);

/**
 * Top-level keys the client cannot function without, asserted against the live
 * response on every run — including --record. The baseline compare alone would
 * miss the case #176 shipped: if upstream drops one of these and someone
 * regenerates the baseline without reading the diff, the recorded shape and
 * the server agree and the compare passes. This list does not regenerate.
 *
 * Only routes that answer 200 on a fresh install can appear here. The client
 * also requires GET /playlists/jobs/:id, but it needs a real playlist and
 * always 404s against a synthetic ID, so it cannot be asserted this way.
 */
const REQUIRED_KEYS = new Map([
  [
    "GET /playlists/status",
    { flowStats: "object", flows: "array", sharedPlaylists: "array" },
  ],
]);

/**
 * The shape of a JSON value, with every concrete value erased:
 *   scalars  -> "string" | "number" | "boolean" | "null"
 *   arrays   -> [] when empty, [<shape of first element>] otherwise
 *   objects  -> { key: <shape>, ... } with keys sorted
 *
 * Arrays are described by their first element only. On the fresh CI container
 * every list is empty anyway, and a merged union of element shapes buys
 * nothing for that cost.
 */
function shapeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value))
    return value.length === 0 ? [] : [shapeOf(value[0])];
  if (typeof value === "object") {
    const shape = {};
    for (const key of Object.keys(value).sort())
      shape[key] = shapeOf(value[key]);
    return shape;
  }
  return typeof value;
}

function kindOf(shape) {
  if (typeof shape === "string") return shape;
  return Array.isArray(shape) ? "array" : "object";
}

/**
 * Collects the differences between a baseline shape and a probed shape.
 *
 * Failures (`missing`, `changed`) are what breaks a reader: a key that is gone
 * or a value whose type moved under it. Additions cannot break a reader and
 * only land in `added`, so the caller can report them without failing.
 *
 * Null matches any type, in both directions. On a fresh install, nullable
 * fields (`lastUpdated`, `lastFailureAt`, `library.lastScan`) reflect timing
 * and provider reachability, not the contract — a strict rule here would make
 * the build flap. The signal #176 taught us to watch for is a key that is
 * *gone*, and that still fails.
 */
function compareShapes(baseline, probed, path, diff) {
  const baseKind = kindOf(baseline);
  const probedKind = kindOf(probed);

  if (baseKind !== probedKind) {
    if (baseKind === "null" || probedKind === "null") return;
    diff.changed.push(`${path}: ${baseKind} -> ${probedKind}`);
    return;
  }

  if (baseKind === "array") {
    // An empty side means no element was observed on that run, which is an
    // unknown element shape, not a conflicting one.
    if (baseline.length > 0 && probed.length > 0) {
      compareShapes(baseline[0], probed[0], `${path}[]`, diff);
    }
    return;
  }

  if (baseKind === "object") {
    for (const key of Object.keys(baseline)) {
      if (key in probed) {
        compareShapes(baseline[key], probed[key], `${path}.${key}`, diff);
      } else {
        diff.missing.push(`${path}.${key}`);
      }
    }
    for (const key of Object.keys(probed)) {
      if (!(key in baseline)) diff.added.push(`${path}.${key}`);
    }
  }
}

/**
 * Pull every `api.<method>("<path>")` call out of lib/api/*.ts.
 *
 * Hand-rolled rather than a regex because the call sites wrap across lines and
 * carry generic type arguments (`api.put<{ success: boolean }>(`), which a
 * single pattern gets wrong often enough to matter.
 */
function extractPocketRoutes() {
  const methods = ["get", "post", "put", "patch", "delete"];
  const routes = [];
  const unresolved = [];

  for (const file of readdirSync(API_DIR).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(API_DIR, file), "utf8");

    // Paths are often assembled from a module constant, e.g.
    // `const FLOW = "/playlists"` then `api.get(`${FLOW}/status`)`. Without
    // resolving those the call site does not start with "/" and would be
    // skipped — silently dropping a whole router from the check.
    const consts = new Map();
    const constRe = /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"\s*;/gm;
    for (const m of src.matchAll(constRe)) consts.set(m[1], m[2]);

    for (const method of methods) {
      const needle = `api.${method}`;
      let from = 0;
      for (;;) {
        const at = src.indexOf(needle, from);
        if (at === -1) break;
        from = at + needle.length;

        // Skip ahead to the argument list, stepping over any generic args.
        const open = src.indexOf("(", from);
        if (open === -1) break;

        // The path is the first string literal after the paren. Anything else
        // in between (whitespace, newlines) is not a quote character.
        let i = open + 1;
        while (i < src.length && /\s/.test(src[i])) i++;
        const quote = src[i];
        if (quote !== '"' && quote !== "'" && quote !== "`") continue;

        const end = src.indexOf(quote, i + 1);
        if (end === -1) continue;

        // Substitute known module constants before deciding whether this looks
        // like a path.
        const raw = src
          .slice(i + 1, end)
          .replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (match, name) =>
            consts.has(name) ? consts.get(name) : match,
          );

        if (!raw.startsWith("/")) {
          // Never skip quietly. If this is a real endpoint the check would
          // stop covering it while still reporting a pass.
          unresolved.push({ method: method.toUpperCase(), raw, file });
          continue;
        }

        routes.push({ method: method.toUpperCase(), raw, file });
      }
    }
  }

  if (unresolved.length > 0) {
    console.error(
      "FAIL: could not resolve these call sites to a concrete path. Add the " +
        "module constant, or the endpoint silently stops being checked:",
    );
    for (const r of unresolved) {
      console.error(`  ${r.method} ${r.raw}  [${r.file}]`);
    }
    process.exit(1);
  }

  return routes;
}

/**
 * `/library/artists/${mbid}` -> `/library/artists/<uuid>`.
 *
 * Picks a UUID for anything named like an mbid and a plain integer otherwise,
 * because Aurral validates MBID shape up front and would answer 400 for a
 * non-UUID — still "exists", but it muddies the output.
 */
function concretize(raw) {
  return raw.replace(/\$\{([^}]+)\}/g, (_match, expr) =>
    /mbid|uuid/i.test(expr) ? SYNTHETIC.uuid : SYNTHETIC.id,
  );
}

async function request(method, path, token) {
  const headers = { Authorization: `Bearer ${token}` };
  // Send a body on writes so a route that validates its input answers 400
  // rather than throwing, which keeps the output readable.
  if (method !== "GET" && method !== "DELETE") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body:
      method === "GET" || method === "DELETE" ? undefined : JSON.stringify({}),
    redirect: "manual",
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return { status: res.status, body, location: res.headers.get("location") };
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (res.status === 429) {
    throw new Error(
      "Login rate-limited (429). Aurral allows 10 logins per 15 minutes — " +
        "start a fresh container rather than re-running against a used one.",
    );
  }
  if (!res.ok) {
    throw new Error(
      `Login failed (${res.status}). Is the Aurral container onboarded?`,
    );
  }
  const { token } = await res.json();
  if (!token) throw new Error("Login succeeded but returned no token.");
  return token;
}

/** Returns true on failure. Runs in both modes — see REQUIRED_KEYS. */
function checkRequiredKeys(shapes) {
  let failed = false;
  for (const [key, required] of REQUIRED_KEYS) {
    const shape = shapes.get(key);
    if (shape === undefined) {
      console.error(
        `\nFAIL: ${key} did not answer 200 with JSON, so its required keys ` +
          "cannot be verified.",
      );
      failed = true;
      continue;
    }
    for (const [topKey, kind] of Object.entries(required)) {
      const got = topKey in shape ? kindOf(shape[topKey]) : undefined;
      if (got !== kind) {
        console.error(
          `\nFAIL: ${key} must carry \`${topKey}\` (${kind}); got ` +
            `${got ?? "no such key"}. The client reads this on the happy path — ` +
            "see #176.",
        );
        failed = true;
      }
    }
  }
  return failed;
}

function writeBaseline(shapes) {
  const baseline = {
    aurralVersion: PINNED_VERSION,
    shapes: Object.fromEntries(
      [...shapes.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(
    `\nRecorded ${shapes.size} response shape(s) for Aurral ${PINNED_VERSION} ` +
      `into ${BASELINE_PATH}. Commit the diff — it is the reviewable record of ` +
      "what changed upstream.",
  );
}

/** Returns true on failure. */
function compareBaseline(shapes) {
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.error(
      `\nFAIL: could not read ${BASELINE_PATH}. Record it against a fresh ` +
        `onboarded Aurral ${PINNED_VERSION} container with --record (see the ` +
        "header of this script).",
    );
    return true;
  }

  if (baseline.aurralVersion !== PINNED_VERSION) {
    console.error(
      `\nFAIL: the shape baseline was recorded against Aurral ` +
        `${baseline.aurralVersion} but .aurral-version pins ${PINNED_VERSION}. ` +
        "Regenerate with --record in the same PR as the version bump, so the " +
        "shape diff gets reviewed alongside it.",
    );
    return true;
  }

  let failed = false;
  const recorded = baseline.shapes ?? {};

  for (const [key, baseShape] of Object.entries(recorded)) {
    if (!shapes.has(key)) {
      console.error(
        `\nFAIL: ${key} is in the shape baseline but no longer answers 200 ` +
          "with JSON. If the call site was removed, regenerate the baseline " +
          "with --record; otherwise the route regressed.",
      );
      failed = true;
      continue;
    }

    const diff = { missing: [], changed: [], added: [] };
    compareShapes(baseShape, shapes.get(key), "body", diff);

    if (diff.missing.length > 0 || diff.changed.length > 0) {
      console.error(`\nFAIL: response shape drifted for ${key}:`);
      for (const p of diff.missing) console.error(`  gone     ${p}`);
      for (const p of diff.changed) console.error(`  retyped  ${p}`);
      failed = true;
    }
    if (diff.added.length > 0) {
      console.log(`  note: new keys on ${key} (harmless; --record to adopt):`);
      for (const p of diff.added) console.log(`    ${p}`);
    }
  }

  for (const key of shapes.keys()) {
    if (!(key in recorded)) {
      console.error(
        `\nFAIL: ${key} answers 200 but has no shape baseline. Regenerate ` +
          "with --record so the new response is covered.",
      );
      failed = true;
    }
  }

  if (!failed) {
    console.log(
      `${Object.keys(recorded).length} response shape(s) match the ` +
        `Aurral ${PINNED_VERSION} baseline.`,
    );
  }
  return failed;
}

async function main() {
  let token = await login();
  const extracted = extractPocketRoutes();
  if (extracted.length === 0) {
    console.error("Extracted no routes from lib/api — the parser is broken.");
    process.exit(1);
  }

  // Defer anything that would end our session until every other route has been
  // probed with a live token.
  const routes = [
    ...extracted.filter((r) => !PROBE_LAST.has(r.raw)),
    ...extracted.filter((r) => PROBE_LAST.has(r.raw)),
  ];
  let reloginsLeft = MAX_RELOGINS;

  const missing = [];
  const moved = [];
  const ok = [];
  const known = [];
  // Allowlist entries that now pass — the drift was fixed and the entry should
  // be deleted, otherwise the list quietly grows into a place bugs hide.
  const stale = [];
  // Shapes of every GET response that answered 200 with JSON, keyed by
  // "<METHOD> <raw path>". Only these routes are shape-checkable: synthetic
  // path parameters make every parameterized route answer 404 on its merits.
  const shapes = new Map();

  for (const route of routes) {
    const path = `/api${concretize(route.raw)}`;
    let result;
    try {
      result = await request(route.method, path, token);
      // Safety net for anything else that invalidates the session: an
      // unexpected 401 is indistinguishable from "route exists", so re-auth and
      // retry once rather than silently recording a pass.
      if (
        result.status === 401 &&
        !PROBE_LAST.has(route.raw) &&
        reloginsLeft > 0
      ) {
        reloginsLeft--;
        token = await login();
        result = await request(route.method, path, token);
      }
    } catch (error) {
      console.error(`  ! ${route.method} ${path} — ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    const isCatchAll =
      result.status === 404 && result.body?.error === CATCH_ALL;
    // A redirect means the route answers at a different path. It works today
    // only because the server kept a compatibility shim, which is exactly the
    // kind of thing that disappears in a major version.
    const isRedirect = result.status >= 300 && result.status < 400;

    // A 401 that survived re-auth means we are probing blind: every route
    // would look present. Fail loudly instead of reporting a meaningless pass.
    if (result.status === 401 && !PROBE_LAST.has(route.raw)) {
      console.error(
        `\nFAIL: ${route.method} ${path} answered 401 after re-authenticating. ` +
          "Every subsequent result would be unreliable.",
      );
      process.exit(1);
    }

    const key = `${route.method} ${route.raw}`;
    const knownReason = KNOWN_DRIFT.get(key);

    if (isCatchAll || isRedirect) {
      const entry = {
        ...route,
        path,
        status: result.status,
        to: result.location,
      };
      if (knownReason) known.push({ ...entry, reason: knownReason });
      else if (isCatchAll) missing.push(entry);
      else moved.push(entry);
    } else {
      if (knownReason) stale.push({ ...route, reason: knownReason });
      ok.push({ ...route, path, status: result.status });
      // Parameterized routes are excluded even when they answer 200: a body
      // produced for a synthetic ID describes a nonexistent record — usually
      // via an external lookup (Lidarr, MusicBrainz, cover art), whose
      // availability would make the recorded shape flap between runs.
      if (
        route.method === "GET" &&
        result.status === 200 &&
        result.body !== undefined &&
        !route.raw.includes("${")
      ) {
        shapes.set(key, shapeOf(result.body));
      }
    }
  }

  for (const r of ok) {
    console.log(`  ok       ${r.method.padEnd(6)} ${r.path} (${r.status})`);
  }
  for (const r of moved) {
    console.log(
      `  MOVED    ${r.method.padEnd(6)} ${r.path} -> ${r.to} (${r.status})`,
    );
  }
  for (const r of missing) {
    console.log(`  MISSING  ${r.method.padEnd(6)} ${r.path}  [${r.file}]`);
  }
  for (const r of known) {
    console.log(`  known    ${r.method.padEnd(6)} ${r.path}  ${r.reason}`);
  }

  console.log(
    `\n${ok.length} ok, ${moved.length} moved, ${missing.length} missing, ${known.length} known, ${routes.length} checked against ${BASE}`,
  );

  let failed = false;

  if (missing.length > 0) {
    console.error(
      `\nFAIL: ${missing.length} endpoint(s) pocket calls do not exist on this Aurral version.`,
    );
    failed = true;
  }
  if (moved.length > 0) {
    console.error(
      `\nFAIL: ${moved.length} endpoint(s) only answer via a redirect. Point pocket at the real path — a compatibility shim is not a contract.`,
    );
    failed = true;
  }
  if (stale.length > 0) {
    console.error(
      `\nFAIL: ${stale.length} KNOWN_DRIFT entr(ies) now pass and must be deleted from the allowlist:`,
    );
    for (const r of stale) {
      console.error(`  ${r.method} ${r.raw}  ${r.reason}`);
    }
    failed = true;
  }

  if (checkRequiredKeys(shapes)) failed = true;

  if (RECORD) {
    if (failed) {
      console.error(
        "\nNot recording a baseline from a failing run — fix the failures " +
          "above first.",
      );
      process.exit(1);
    }
    writeBaseline(shapes);
    return;
  }

  if (compareBaseline(shapes)) failed = true;

  if (failed) process.exit(1);

  if (known.length > 0) {
    console.log(
      `\nPASS with ${known.length} known drift item(s) still outstanding.`,
    );
  } else {
    console.log(
      "\nPASS: every endpoint pocket calls exists and every recorded " +
        "response shape matches the baseline.",
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
