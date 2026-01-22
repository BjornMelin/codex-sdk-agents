import { runDoctor } from "./commands/doctor.js";

/**
 * Valid commands supported by the CLI.
 */
type Command = "doctor";

/**
 * Prints CLI usage information and available commands.
 *
 * @remarks
 * This is intentionally kept small for the bootstrap phase (SPEC 000).
 */
function printUsage(): void {
  // Keep this intentionally small for the bootstrap phase (SPEC 000).
  // Future SPECs will replace this with a richer command registry.
  console.log(
    [
      "codex-toolloop (bootstrap)",
      "",
      "Usage:",
      "  codex-toolloop doctor",
      "",
      "Commands:",
      "  doctor    Validate environment (node, pnpm, codex)",
    ].join("\n"),
  );
}

/**
 * Parses the command line arguments to determine the command to run.
 *
 * @param argv - The raw command line arguments (excluding node and script paths).
 * @returns The parsed command or null if not recognized.
 */
function parseCommand(argv: readonly string[]): Command | null {
  const [command] = argv;
  if (command === "doctor") {
    return "doctor";
  }
  return null;
}

const args = process.argv.slice(2);
const command = parseCommand(args);

if (command === "doctor") {
  const exitCode = runDoctor();
  process.exit(exitCode);
}

printUsage();
process.exit(1);
