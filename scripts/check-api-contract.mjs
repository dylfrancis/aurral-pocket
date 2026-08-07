#!/usr/bin/env node
/**
 * Verifies every endpoint pocket calls still exists on the Aurral version we
 * target.
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
 * Usage:
 *   AURRAL_URL=http://localhost:3001 node scripts/check-api-contract.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(ROOT, "lib", "api");
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
const KNOWN_DRIFT = new Map([
  [
    "GET /search/artists",
    "#167 — removed in Aurral 2.0, migrate to /search/unified",
  ],
]);

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

  if (failed) process.exit(1);

  if (known.length > 0) {
    console.log(
      `\nPASS with ${known.length} known drift item(s) still outstanding.`,
    );
  } else {
    console.log("\nPASS: every endpoint pocket calls exists.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
