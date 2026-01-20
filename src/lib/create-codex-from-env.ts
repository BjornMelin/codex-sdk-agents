import { Codex } from "@openai/codex-sdk";

export type CreateCodexFromEnvOptions = {
  codexPathOverride?: string;
  baseUrlEnvVar?: string;
  apiKeyEnvVar?: string;
};

export function createCodexFromEnv(options: CreateCodexFromEnvOptions = {}): Codex {
  const baseUrlEnvVar = options.baseUrlEnvVar ?? "OPENAI_BASE_URL";
  const apiKeyEnvVar = options.apiKeyEnvVar ?? "CODEX_API_KEY";

  const baseUrl = process.env[baseUrlEnvVar];
  const apiKey = process.env[apiKeyEnvVar] ?? process.env.OPENAI_API_KEY;

  return new Codex({
    codexPathOverride: options.codexPathOverride,
    baseUrl,
    apiKey,
  });
}
