import { flowFormSchema } from "@/lib/flow-form-schema";
import { createDefaultFlowForm } from "@/lib/types/flow";

const validForm = () => ({
  ...createDefaultFlowForm(),
  scheduleDays: [1],
});

describe("flowFormSchema", () => {
  it("accepts the default form", () => {
    expect(flowFormSchema.safeParse(validForm()).success).toBe(true);
  });

  it("requires recordHistory", () => {
    const { recordHistory, ...withoutRecordHistory } = validForm();
    expect(flowFormSchema.safeParse(withoutRecordHistory).success).toBe(false);
  });

  it("accepts recordHistory disabled", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      recordHistory: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a focused mix with at least one tag", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      mix: { discover: 30, mix: 20, trending: 10, focus: 40 },
      tags: ["ambient"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects focus > 0 with no tags or related artists", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      mix: { discover: 30, mix: 20, trending: 10, focus: 40 },
      tags: [],
      relatedArtists: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Focus needs at least one genre tag or related artist",
      );
      expect(result.error.issues[0].path).toEqual(["tags"]);
    }
  });

  it("rejects a mix that does not total 100 across all four channels", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      mix: { discover: 50, mix: 30, trending: 20, focus: 40 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty scheduleDays", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      scheduleDays: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Pick at least one day");
    }
  });

  it("accepts an open range on both ends", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      yearFrom: null,
      yearTo: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a closed range", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      yearFrom: 1990,
      yearTo: 1999,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a range with one open end", () => {
    expect(
      flowFormSchema.safeParse({ ...validForm(), yearFrom: 2000, yearTo: null })
        .success,
    ).toBe(true);
    expect(
      flowFormSchema.safeParse({ ...validForm(), yearFrom: null, yearTo: 2000 })
        .success,
    ).toBe(true);
  });

  it("accepts a single-year range", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      yearFrom: 1977,
      yearTo: 1977,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a year below the 4-digit range", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      yearFrom: 999,
      yearTo: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Year must have 4 digits");
      expect(result.error.issues[0].path).toEqual(["yearFrom"]);
    }
  });

  it("rejects a year above the 4-digit range", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      yearFrom: null,
      yearTo: 10000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Year must have 4 digits");
      expect(result.error.issues[0].path).toEqual(["yearTo"]);
    }
  });

  it("rejects a fractional year", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      yearFrom: 1990.5,
      yearTo: null,
    });
    expect(result.success).toBe(false);
  });

  // Aurral swaps an inverted range rather than rejecting it, so the form has
  // to catch it or the user gets a range they never asked for.
  it("rejects an inverted range", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      yearFrom: 1999,
      yearTo: 1990,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "To year must not be before the from year",
      );
      expect(result.error.issues[0].path).toEqual(["yearTo"]);
    }
  });

  it("accepts tags and related artists with focus at 0 (stored but inactive)", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      tags: ["ambient", "shoegaze"],
      relatedArtists: ["Slowdive"],
    });
    expect(result.success).toBe(true);
  });
});
