import { z } from "zod";
import { FLOW_SIZE_MAX, FLOW_SIZE_MIN } from "@/lib/types/flow";

export const flowFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    size: z.number().int().min(FLOW_SIZE_MIN).max(FLOW_SIZE_MAX),
    mix: z
      .object({
        discover: z.number().min(0).max(100),
        mix: z.number().min(0).max(100),
        trending: z.number().min(0).max(100),
        focus: z.number().min(0).max(100),
      })
      .refine(
        (m) => Math.round(m.discover + m.mix + m.trending + m.focus) === 100,
        { message: "Mix must total 100%" },
      ),
    deepDive: z.boolean(),
    tags: z.array(z.string()),
    relatedArtists: z.array(z.string()),
    scheduleDays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Pick at least one day"),
    scheduleTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
  })
  .superRefine((values, ctx) => {
    if (
      values.mix.focus > 0 &&
      values.tags.length === 0 &&
      values.relatedArtists.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tags"],
        message: "Focus needs at least one genre tag or related artist",
      });
    }
  });

export type FlowFormSchema = z.infer<typeof flowFormSchema>;
