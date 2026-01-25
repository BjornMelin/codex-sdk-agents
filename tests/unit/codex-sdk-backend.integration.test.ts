import { describe, expect, it } from "vitest";

const integrationEnabled =
  process.env.CODEX_SDK_INTEGRATION === "1" &&
  Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY);
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration("SdkBackend integration (Codex SDK)", () => {
  it("runs a minimal prompt via the real Codex SdkBackend", async () => {
    const { SdkBackend } = await import("../../packages/codex/src/index.js");

    const defaultModel = process.env.CODEX_SDK_INTEGRATION_MODEL;
    const backend = new SdkBackend(defaultModel ? { defaultModel } : undefined);

    const result = await backend.run("Reply with OK.", {
      cwd: process.cwd(),
      sandboxMode: "read-only",
      approvalMode: "never",
      skipGitRepoCheck: true,
    });

    expect(result.backend).toBe("sdk");
    expect(result.text.toLowerCase()).toContain("ok");
  }, 60_000);
});
