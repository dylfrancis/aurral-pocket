import { z } from "zod";
import {
  FLOW_SIZE_MAX,
  FLOW_SIZE_MIN,
  FLOW_YEAR_MAX,
  FLOW_YEAR_MIN,
} from "@/lib/types/flow";

// null leaves that end of the range open. Aurral treats an out-of-range year
// as a 400 error, so reject it here instead.
const yearBound = z
  .number()
  .int("Year must be a whole number")
  .min(FLOW_YEAR_MIN, "Year must have 4 digits")
  .max(FLOW_YEAR_MAX, "Year must have 4 digits")
  .nullable();

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
    recordHistory: z.boolean(),
    yearFrom: yearBound,
    yearTo: yearBound,
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
    // Aurral swaps an inverted range instead of rejecting it, which silently
    // saves a range the user did not ask for. Reject it here.
    if (
      values.yearFrom != null &&
      values.yearTo != null &&
      values.yearFrom > values.yearTo
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["yearTo"],
        message: "To year must not be before the from year",
      });
    }
  });

export type FlowFormSchema = z.infer<typeof flowFormSchema>;
