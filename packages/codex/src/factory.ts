import { AppServerBackend } from "./app-server-backend.js";
import type { CodexBackend, CodexBackendKind } from "./backend.js";
import { ExecBackend } from "./exec-backend.js";
import { SdkBackend } from "./sdk-backend.js";

/**
 * Configuration union for constructing a Codex backend instance.
 *
 * @see docs/specs/020-codex-backends.md
 */
export type CreateCodexBackendConfig =
  | {
      kind: "app-server";
      codexPath?: string;
      defaultModel?: string;
    }
  | {
      kind: "exec";
      command?: string;
      commandArgsPrefix?: readonly string[];
    }
  | ({
      kind: "sdk";
    } & ConstructorParameters<typeof SdkBackend>[0]);

/**
 * Instantiate a Codex backend based on the provided config.
 *
 * @param config - Backend selection and settings.
 * @returns Configured backend implementation.
 * @see docs/specs/020-codex-backends.md
 */
export function createCodexBackend(
  config: CreateCodexBackendConfig,
): CodexBackend {
  switch (config.kind) {
    case "app-server":
      return new AppServerBackend({
        ...(config.codexPath !== undefined
          ? { codexPath: config.codexPath }
          : {}),
        ...(config.defaultModel !== undefined
          ? { defaultModel: config.defaultModel }
          : {}),
      });
    case "exec":
      return new ExecBackend({
        ...(config.command !== undefined ? { command: config.command } : {}),
        ...(config.commandArgsPrefix !== undefined
          ? { commandArgsPrefix: config.commandArgsPrefix }
          : {}),
      });
    case "sdk":
      return new SdkBackend(config);
    default: {
      const exhaustive: never = config;
      throw new Error(`Unsupported backend kind: ${String(exhaustive)}`);
    }
  }
}

/**
 * Check whether a string is a valid Codex backend identifier.
 *
 * @param value - Candidate backend identifier.
 * @returns True when the value matches a supported backend.
 * @see docs/specs/020-codex-backends.md
 */
export function isCodexBackendKind(value: string): value is CodexBackendKind {
  return value === "app-server" || value === "exec" || value === "sdk";
}
