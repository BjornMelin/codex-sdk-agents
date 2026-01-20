import { createCodexFromEnv } from "../src/lib/create-codex-from-env.js";
import { gitDiff } from "../src/lib/git.js";
import {
  buildCodeReviewPrompt,
  CodeReviewOutputSchema,
  codeReviewJsonSchema,
} from "../src/workflows/code-review.js";

const base = process.env.REVIEW_BASE;
const head = process.env.REVIEW_HEAD;
const diff = gitDiff({ base, head });

if (diff.trim().length === 0) {
  console.error("No diff to review.");
  process.exit(0);
}

const prompt = buildCodeReviewPrompt({ diff, extraFocus: process.env.REVIEW_FOCUS });

const codex = createCodexFromEnv();
const thread = codex.startThread({
  workingDirectory: process.cwd(),
  sandboxMode: "read-only",
  approvalPolicy: "never",
});

const turn = await thread.run(prompt, { outputSchema: codeReviewJsonSchema });

const parsed = safeJsonParse(turn.finalResponse);
const validated = CodeReviewOutputSchema.parse(parsed);
process.stdout.write(`${JSON.stringify(validated, null, 2)}\n`);

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Codex response was not valid JSON: ${message}\n\nRaw:\n${text}`);
  }
}
