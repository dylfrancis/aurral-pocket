import {
  headerRowsSchema,
  headersToRows,
  newHeaderRow,
  rowsToHeaders,
} from "@/lib/custom-headers";

function issuesFor(rows: [string, string][]) {
  const result = headerRowsSchema.safeParse(
    rows.map(([name, value]) => newHeaderRow(name, value)),
  );
  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      }));
}

describe("headerRowsSchema", () => {
  it("accepts a Cloudflare Access service token, and skips a blank row", () => {
    expect(
      issuesFor([
        ["CF-Access-Client-Id", "abc.access"],
        ["CF-Access-Client-Secret", "s3cr3t"],
        ["", "  "],
      ]),
    ).toEqual([]);
  });

  it.each<[string, [string, string][], { path: unknown[]; message: string }]>([
    [
      "a value with no name",
      [["", "abc"]],
      { path: [0, "name"], message: "Add a header name." },
    ],
    [
      "a name a request can't carry",
      [["CF Access", "abc"]],
      {
        path: [0, "name"],
        message:
          "Use only letters, numbers, dashes and underscores in a header name.",
      },
    ],
    [
      "a header pocket sets itself, in any case",
      [["authorization", "Basic abc"]],
      {
        path: [0, "name"],
        message: "Aurral Pocket sets authorization itself.",
      },
    ],
    [
      "the same name twice, in any case",
      [
        ["X-Token", "a"],
        ["x-token", "b"],
      ],
      { path: [1, "name"], message: "x-token is already in the list." },
    ],
    [
      "a name with no value",
      [["X-Token", "  "]],
      { path: [0, "value"], message: "Add a value for X-Token." },
    ],
    [
      "a line break inside the value",
      [["X-Token", "a\r\nX-Injected: 1"]],
      {
        path: [0, "value"],
        message: "Remove line breaks and special characters.",
      },
    ],
  ])("refuses %s", (_, rows, issue) => {
    expect(issuesFor(rows)).toEqual([issue]);
  });
});

describe("rowsToHeaders", () => {
  it("trims names and values, and drops blank rows", () => {
    expect(
      rowsToHeaders([
        newHeaderRow(" CF-Access-Client-Id ", " abc.access\n"),
        newHeaderRow("", ""),
      ]),
    ).toEqual({ "CF-Access-Client-Id": "abc.access" });
  });

  it("round-trips the saved headers through the editor's rows", () => {
    const saved = { "CF-Access-Client-Id": "abc", "X-Token": "def" };
    expect(rowsToHeaders(headersToRows(saved))).toEqual(saved);
  });
});
