/**
 * Example of extracting structured data using a JSON schema.
 */
import { createCodexFromEnv } from "../src/lib/create-codex-from-env.js";

const codex = createCodexFromEnv();
const thread = codex.startThread({
  workingDirectory: process.cwd(),
  sandboxMode: "read-only",
  approvalPolicy: "never",
});

const schema = {
  type: "object",
  properties: {
    project_name: { type: "string" },
    goals: { type: "array", items: { type: "string" } },
  },
  required: ["project_name", "goals"],
  additionalProperties: false,
} as const;

const turn = await thread.run(
  "Extract project_name and goals from this repository.",
  {
    outputSchema: schema,
  },
);
console.log(turn.finalResponse);
