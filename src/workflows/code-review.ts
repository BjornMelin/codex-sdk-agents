import { z } from "zod";

export const CodeReviewFindingSchema = z.strictObject({
  title: z.string().min(1).max(80),
  body: z.string().min(1),
  confidence_score: z.number().min(0).max(1),
  priority: z.number().int().min(0).max(3).optional(),
  code_location: z
    .strictObject({
      absolute_file_path: z.string().min(1),
      line_range: z.strictObject({
        start: z.number().int().min(1),
        end: z.number().int().min(1),
      }),
    })
    .optional(),
});

export const CodeReviewOutputSchema = z.strictObject({
  findings: z.array(CodeReviewFindingSchema),
  overall_correctness: z.enum(["patch is correct", "patch is incorrect"]),
  overall_explanation: z.string().min(1),
  overall_confidence_score: z.number().min(0).max(1),
});

export type CodeReviewOutput = z.infer<typeof CodeReviewOutputSchema>;

export const codeReviewJsonSchema = z.toJSONSchema(CodeReviewOutputSchema);

export function buildCodeReviewPrompt(args: { diff: string; extraFocus?: string }): string {
  const focus = args.extraFocus?.trim();
  const focusLine = focus ? `Extra focus: ${focus}\n\n` : "";

  return [
    "You are acting as a reviewer for a proposed code change made by another engineer.",
    "Focus on issues that impact correctness, performance, security, maintainability, or developer experience.",
    "Flag only actionable issues introduced by the change.",
    "When you flag an issue, cite the affected file and an exact line range.",
    "Prioritize severe issues and avoid nit-level comments unless they block understanding of the diff.",
    "",
    focusLine.trimEnd(),
    "Here is the unified diff to review:",
    "",
    args.diff.trimEnd(),
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}
