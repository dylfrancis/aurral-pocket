jest.mock("@/lib/api/client", () => ({
  api: {
    defaults: { baseURL: "https://example.com/api" },
  },
}));

import { getFlowStreamSource, getFlowArtworkSource } from "@/lib/api/flow";

describe("getFlowStreamSource", () => {
  it("returns the stream URL with no headers when token is null", () => {
    const source = getFlowStreamSource("job-1", null);
    expect(source).toEqual({
      uri: "https://example.com/api/weekly-flow/stream/job-1",
    });
  });

  it("attaches a Bearer Authorization header when a token is provided", () => {
    const source = getFlowStreamSource("job-1", "secret");
    expect(source).toEqual({
      uri: "https://example.com/api/weekly-flow/stream/job-1",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("does not put the token in the URL", () => {
    const { uri } = getFlowStreamSource("job-1", "secret");
    expect(uri).not.toContain("token=");
    expect(uri).not.toContain("secret");
  });

  it("encodes the job id", () => {
    const { uri } = getFlowStreamSource("job/1?weird", "secret");
    expect(uri).toBe(
      "https://example.com/api/weekly-flow/stream/job%2F1%3Fweird",
    );
  });
});

describe("getFlowArtworkSource", () => {
  it("returns the artwork URL with no headers when token is null", () => {
    const source = getFlowArtworkSource("pl-1", null);
    expect(source).toEqual({
      uri: "https://example.com/api/weekly-flow/artwork/pl-1",
    });
  });

  it("attaches a Bearer Authorization header when a token is provided", () => {
    const source = getFlowArtworkSource("pl-1", "secret");
    expect(source).toEqual({
      uri: "https://example.com/api/weekly-flow/artwork/pl-1",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("does not put the token in the URL", () => {
    const { uri } = getFlowArtworkSource("pl-1", "secret");
    expect(uri).not.toContain("token=");
    expect(uri).not.toContain("secret");
  });
});
