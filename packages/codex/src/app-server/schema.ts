import type {
  ClientRequest,
  RequestId,
  ServerNotification,
  ServerRequest,
} from "@codex-toolloop/codex-app-server-protocol";
import { z } from "zod";

const requestIdSchema = z.union([z.string(), z.number()]);

const jsonRpcRequestSchema = z.looseObject({
  id: requestIdSchema,
  method: z.string(),
  params: z.unknown().optional(),
});

const jsonRpcNotificationSchema = z.looseObject({
  method: z.string(),
  params: z.unknown().optional(),
});

const jsonRpcResponseSchema = z.looseObject({
  id: requestIdSchema,
  result: z.unknown(),
});

const jsonRpcErrorSchema = z.looseObject({
  id: requestIdSchema,
  error: z.looseObject({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }),
});

const jsonRpcMessageSchema = z.union([
  jsonRpcRequestSchema,
  jsonRpcNotificationSchema,
  jsonRpcResponseSchema,
  jsonRpcErrorSchema,
]);

type JsonRpcRequest = { id: RequestId; method: string; params?: unknown };

type JsonRpcNotification = { method: string; params?: unknown };

type JsonRpcResponse = { id: RequestId; result: unknown };

type JsonRpcError = {
  id: RequestId;
  error: { code: number; message: string; data?: unknown };
};

const validate =
  <T>(schema: z.ZodTypeAny) =>
  (value: unknown): value is T =>
    schema.safeParse(value).success;

/**
 * Runtime validators for Codex app-server JSON-RPC envelopes.
 *
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export type CodexAppServerSchemaValidators = {
  isJsonRpcMessage: (value: unknown) => boolean;
  isJsonRpcRequest: (value: unknown) => value is JsonRpcRequest;
  isJsonRpcNotification: (value: unknown) => value is JsonRpcNotification;
  isJsonRpcResponse: (value: unknown) => value is JsonRpcResponse;
  isJsonRpcError: (value: unknown) => value is JsonRpcError;
  isClientRequest: (value: unknown) => value is ClientRequest;
  isServerNotification: (value: unknown) => value is ServerNotification;
  isServerRequest: (value: unknown) => value is ServerRequest;
};

let cached: CodexAppServerSchemaValidators | null = null;

/**
 * Build Zod-based validators for app-server JSON-RPC envelopes.
 *
 * @returns Validator functions for JSON-RPC messages plus loose request checks.
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export function getCodexAppServerSchemaValidators(): CodexAppServerSchemaValidators {
  if (cached) {
    return cached;
  }

  const validators: CodexAppServerSchemaValidators = {
    isJsonRpcMessage: (value) => jsonRpcMessageSchema.safeParse(value).success,
    isJsonRpcRequest: validate<JsonRpcRequest>(jsonRpcRequestSchema),
    isJsonRpcNotification: validate<JsonRpcNotification>(
      jsonRpcNotificationSchema,
    ),
    isJsonRpcResponse: validate<JsonRpcResponse>(jsonRpcResponseSchema),
    isJsonRpcError: validate<JsonRpcError>(jsonRpcErrorSchema),
    isClientRequest: validate<ClientRequest>(jsonRpcRequestSchema),
    isServerNotification: validate<ServerNotification>(
      jsonRpcNotificationSchema,
    ),
    isServerRequest: validate<ServerRequest>(jsonRpcRequestSchema),
  };

  cached = validators;
  return validators;
}
