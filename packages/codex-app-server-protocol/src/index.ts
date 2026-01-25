/**
 * Codex app-server protocol type exports.
 *
 * @see docs/adr/0013-codex-app-server-protocol-types.md
 */
export type * from "./generated/index.js";
export type {
  ApplyPatchApprovalResponse,
  ExecCommandApprovalResponse,
  RequestId,
} from "./generated/index.js";

/**
 * Codex app-server v2 namespace exports.
 *
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export type * as v2 from "./generated/v2/index.js";
