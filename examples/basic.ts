/**
 * Basic example of using Codex to interact with a repository.
 */
import { createCodexFromEnv } from "../src/lib/create-codex-from-env.js";

const codex = createCodexFromEnv();
const thread = codex.startThread({
  workingDirectory: process.cwd(),
  sandboxMode: "read-only",
  approvalPolicy: "never",
});

const turn = await thread.run(
  "Summarize the repository structure and purpose.",
);
console.log(turn.finalResponse);
