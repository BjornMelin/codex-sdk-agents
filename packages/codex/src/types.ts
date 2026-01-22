/** JSON primitive values accepted by Codex utilities. */
export type JsonPrimitive = string | number | boolean | null;
/** JSON value union used for Codex payloads. */
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
/** JSON object shape used for Codex payloads. */
export type JsonObject = { [key: string]: JsonValue };

/**
 * Stringify JSON values with the default JSON serializer.
 *
 * @param value - JSON value to serialize.
 * @returns JSON string representation.
 * @see docs/specs/020-codex-backends.md
 */
export function jsonStringify(value: JsonValue): string {
  return JSON.stringify(value);
}

/**
 * Check whether a value is a plain JSON object.
 *
 * @param value - Value to inspect.
 * @returns True when the value is a non-null, non-array object.
 * @see docs/specs/020-codex-backends.md
 */
export function isJsonObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  return true;
}
