import { describe, expect, it } from "vitest";
import { buildCodeReviewPrompt } from "./code-review.js";

describe("buildCodeReviewPrompt", () => {
  it("includes the diff and focus when provided", () => {
    const prompt = buildCodeReviewPrompt({
      diff: "diff --git a/a.txt b/a.txt\n+hello\n",
      extraFocus: "security regressions",
    });

    expect(prompt).toContain("Extra focus: security regressions");
    expect(prompt).toContain("diff --git a/a.txt b/a.txt");
  });
});
