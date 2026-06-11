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

  it("accepts tags and related artists with focus at 0 (stored but inactive)", () => {
    const result = flowFormSchema.safeParse({
      ...validForm(),
      tags: ["ambient", "shoegaze"],
      relatedArtists: ["Slowdive"],
    });
    expect(result.success).toBe(true);
  });
});
