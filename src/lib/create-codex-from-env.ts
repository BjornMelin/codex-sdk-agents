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
 * @param options - Options to customize the Codex instance.
 * @returns A Codex instance.
 * @see docs/specs/020-codex-backends.md
 */
export function createCodexFromEnv(
  options: CreateCodexFromEnvOptions = {},
): Codex {
  const baseUrlEnvVar = options.baseUrlEnvVar ?? "OPENAI_BASE_URL";
  const apiKeyEnvVar = options.apiKeyEnvVar ?? "CODEX_API_KEY";

  const baseUrl = process.env[baseUrlEnvVar]?.trim() || undefined;
  const apiKey =
    (process.env[apiKeyEnvVar] ?? process.env.OPENAI_API_KEY)?.trim() ||
    undefined;

  const config: {
    codexPathOverride?: string;
    baseUrl?: string;
    apiKey?: string;
  } = {};

  if (options.codexPathOverride !== undefined) {
    config.codexPathOverride = options.codexPathOverride;
  }
  if (baseUrl) {
    config.baseUrl = baseUrl;
  }
  if (apiKey) {
    config.apiKey = apiKey;
  }

  return new Codex(config);
}
