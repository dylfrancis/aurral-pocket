import { isUpgradeCandidate } from "@/lib/types/flow";

describe("isUpgradeCandidate", () => {
  it("accepts a done job below the cutoff tier", () => {
    expect(
      isUpgradeCandidate({ status: "done", qualityState: "upgrade" }),
    ).toBe(true);
    expect(
      isUpgradeCandidate({ status: "done", qualityState: "below-floor" }),
    ).toBe(true);
  });

  it("rejects a job that is already at the preferred tier", () => {
    expect(
      isUpgradeCandidate({ status: "done", qualityState: "preferred" }),
    ).toBe(false);
  });

  it("rejects external files", () => {
    expect(
      isUpgradeCandidate({ status: "done", qualityState: "external" }),
    ).toBe(false);
  });

  it("rejects unfinished jobs regardless of state", () => {
    expect(
      isUpgradeCandidate({ status: "downloading", qualityState: "upgrade" }),
    ).toBe(false);
  });

  it("rejects jobs from servers that do not send quality fields", () => {
    expect(isUpgradeCandidate({ status: "done" })).toBe(false);
    expect(isUpgradeCandidate({ status: "done", qualityState: null })).toBe(
      false,
    );
  });
});
