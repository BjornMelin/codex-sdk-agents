import { spawnSync } from "node:child_process";

export function gitDiff(args: { base?: string; head?: string }): string {
  const base = args.base ?? "HEAD~1";
  const head = args.head ?? "HEAD";

  const result = spawnSync("git", ["diff", "--no-color", `${base}...${head}`], {
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`Failed to run git diff: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `git diff failed (exit ${result.status}): ${result.stderr}`,
    );
  }

  return result.stdout;
}
