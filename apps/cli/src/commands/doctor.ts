import { spawnSync } from "node:child_process";

/**
 * Valid keys for environment checks.
 */
type CheckKey = "node" | "pnpm" | "codex";

/**
 * Definition of an environment check.
 */
type Check = {
  key: CheckKey;
  label: string;
  command: string;
  args: readonly string[];
};

/**
 * Result of executing an environment check.
 */
type CheckResult = {
  ok: boolean;
  output?: string;
  error?: string;
};

/**
 * Runs a command to retrieve its version information.
 * @param command - The command to execute.
 * @param args - Arguments to pass to the command.
 * @returns The result of the command execution.
 */
function runCommandVersion(
  command: string,
  args: readonly string[],
): CheckResult {
  const result = spawnSync(command, [...args], {
    encoding: "utf-8",
    windowsHide: true,
  });

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  const out = (result.stdout ?? "").toString().trim();
  const err = (result.stderr ?? "").toString().trim();

  if (result.status !== 0) {
    return {
      ok: false,
      error: err.length > 0 ? err : `Exit code ${result.status ?? "unknown"}`,
    };
  }

  return { ok: true, output: out.length > 0 ? out : err };
}

/**
 * Parses the major version number from Node.js version output.
 * @param versionOutput - The raw version string (e.g., "v24.13.0").
 * @returns The major version number or null if parsing fails.
 */
function parseNodeMajor(versionOutput: string): number | null {
  // node --version returns e.g. "v24.13.0".
  const match = /^v(\d+)(?:\.|$)/.exec(versionOutput.trim());
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  return Number.isFinite(major) ? major : null;
}

/**
 * Executes environment diagnostic checks for the CLI.
 *
 * Validates that required tools (Node.js, pnpm, codex) are installed and
 * meet version requirements.
 *
 * @returns Exit code (0 for success, 1 for failure).
 * @remarks
 * Requirements defined in bootstrap phase (SPEC 000).
 */
export function runDoctor(): number {
  const checks: readonly Check[] = [
    { key: "node", label: "node", command: "node", args: ["--version"] },
    { key: "pnpm", label: "pnpm", command: "pnpm", args: ["--version"] },
    { key: "codex", label: "codex", command: "codex", args: ["--version"] },
  ];

  const hints: Record<CheckKey, string> = {
    node: "Install Node.js 24 LTS: https://nodejs.org/en/download",
    pnpm: "Install pnpm (recommended via Corepack): https://pnpm.io/installation#using-corepack",
    codex: "Install OpenAI Codex CLI: https://developers.openai.com/codex/cli",
  };

  let ok = true;

  console.log("\nEnvironment checks:\n");

  for (const check of checks) {
    const result = runCommandVersion(check.command, check.args);

    if (check.key === "node" && result.ok && result.output) {
      const major = parseNodeMajor(result.output);
      if (major === null) {
        ok = false;
        console.log(
          `❌ ${check.label}: ${result.output} (could not parse version)`,
        );
        console.log(`   hint: ${hints[check.key]}`);
        continue;
      }

      if (major < 24) {
        ok = false;
        console.log(
          `❌ ${check.label}: ${result.output} (requires v24.x LTS+)`,
        );
        console.log(`   hint: ${hints[check.key]}`);
        continue;
      }

      console.log(`✅ ${check.label}: ${result.output}`);
      continue;
    }

    if (result.ok) {
      console.log(`✅ ${check.label}: ${result.output ?? "ok"}`);
      continue;
    }

    ok = false;
    console.log(`❌ ${check.label}: ${result.error ?? "failed"}`);
    console.log(`   hint: ${hints[check.key]}`);
  }

  console.log("");

  if (!ok) {
    console.log("One or more checks failed.");
    return 1;
  }

  console.log("All checks passed.");
  return 0;
}
