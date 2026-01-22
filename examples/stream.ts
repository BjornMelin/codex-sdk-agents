/**
 * Example of streaming events from a Codex thread.
 */
import type { ThreadEvent } from "@openai/codex-sdk";

import { createCodexFromEnv } from "../src/lib/create-codex-from-env.js";

const codex = createCodexFromEnv();
const thread = codex.startThread({
  workingDirectory: process.cwd(),
  sandboxMode: "read-only",
  approvalPolicy: "never",
});

const { events } = await thread.runStreamed(
  "List the key files and what they are for.",
);

for await (const event of events) {
  logEvent(event);
}

/**
 * Logs a thread event to the console.
 * @param event - The thread event to log.
 */
function logEvent(event: ThreadEvent) {
  switch (event.type) {
    case "thread.started":
      console.error(`thread.started ${event.thread_id}`);
      return;
    case "turn.started":
      console.error("turn.started");
      return;
    case "turn.completed":
      console.error(
        `turn.completed input=${event.usage.input_tokens} cached=${event.usage.cached_input_tokens} output=${event.usage.output_tokens}`,
      );
      return;
    case "turn.failed":
      console.error(`turn.failed ${event.error.message}`);
      return;
    case "error":
      console.error(`error ${event.message}`);
      return;
    case "item.started":
    case "item.updated":
    case "item.completed":
      console.error(`${event.type} ${event.item.type}`);
      return;
  }
}
