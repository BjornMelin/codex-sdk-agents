import { Codex } from "@openai/codex-sdk";

/**
 * Options for creating a Codex instance from environment variables.
 */
export type CreateCodexFromEnvOptions = {
  codexPathOverride?: string;
  baseUrlEnvVar?: string;
  apiKeyEnvVar?: string;
};

/**
 * Creates a Codex instance from environment variables.
 * @param options Options to customize the Codex instance.
 * @returns A Codex instance.
 */
export function createCodexFromEnv(
  options: CreateCodexFromEnvOptions = {},
): Codex {
  const baseUrlEnvVar = options.baseUrlEnvVar ?? "OPENAI_BASE_URL";
  const apiKeyEnvVar = options.apiKeyEnvVar ?? "CODEX_API_KEY";

  const baseUrl = process.env[baseUrlEnvVar];
  const apiKey = process.env[apiKeyEnvVar] ?? process.env.OPENAI_API_KEY;

  const config: {
    codexPathOverride?: string;
    baseUrl?: string;
    apiKey?: string;
  } = {};

  if (options.codexPathOverride !== undefined) {
    config.codexPathOverride = options.codexPathOverride;
  }
  if (baseUrl !== undefined) {
    config.baseUrl = baseUrl;
  }
  if (apiKey !== undefined) {
    config.apiKey = apiKey;
  }

  return new Codex(config);
}
