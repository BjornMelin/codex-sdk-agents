import type {
  ApplyPatchApprovalResponse,
  ExecCommandApprovalResponse,
  RequestId,
  ServerNotification,
  ServerRequest,
  v2,
} from "@codex-toolloop/codex-app-server-protocol";

import {
  CodexAppServerClient,
  type CodexAppServerClientOptions,
} from "./client.js";

/**
 * Convenience wrapper around the Codex app-server JSON-RPC client.
 *
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export type CodexAppServerBridge = {
  /** Underlying JSON-RPC client instance. */
  client: CodexAppServerClient;

  /** Ensure the app-server process has completed initialization. */
  ensureStarted: () => Promise<void>;
  /** Close the app-server process. */
  close: () => Promise<void>;

  /** Subscribe to notifications. */
  onNotification: (
    listener: (notification: ServerNotification) => void,
  ) => () => void;
  /** Subscribe to server-initiated requests. */
  onServerRequest: (listener: (request: ServerRequest) => void) => () => void;

  /** Thread lifecycle. */
  startThread: (
    params: v2.ThreadStartParams,
  ) => Promise<v2.ThreadStartResponse>;
  resumeThread: (
    params: v2.ThreadResumeParams,
  ) => Promise<v2.ThreadResumeResponse>;
  forkThread: (params: v2.ThreadForkParams) => Promise<v2.ThreadForkResponse>;
  readThread: (params: v2.ThreadReadParams) => Promise<v2.ThreadReadResponse>;
  listThreads: (params: v2.ThreadListParams) => Promise<v2.ThreadListResponse>;
  listLoadedThreads: (
    params: v2.ThreadLoadedListParams,
  ) => Promise<v2.ThreadLoadedListResponse>;
  archiveThread: (
    params: v2.ThreadArchiveParams,
  ) => Promise<v2.ThreadArchiveResponse>;
  rollbackThread: (
    params: v2.ThreadRollbackParams,
  ) => Promise<v2.ThreadRollbackResponse>;

  /** Turn + review lifecycle. */
  startTurn: (params: v2.TurnStartParams) => Promise<v2.TurnStartResponse>;
  interruptTurn: (
    params: v2.TurnInterruptParams,
  ) => Promise<v2.TurnInterruptResponse>;
  startReview: (
    params: v2.ReviewStartParams,
  ) => Promise<v2.ReviewStartResponse>;
  listModels: (params: v2.ModelListParams) => Promise<v2.ModelListResponse>;

  /** Skills + collaboration modes. */
  listSkills: (params: v2.SkillsListParams) => Promise<v2.SkillsListResponse>;
  writeSkillConfig: (
    params: v2.SkillsConfigWriteParams,
  ) => Promise<v2.SkillsConfigWriteResponse>;
  listCollaborationModes: (
    params: v2.CollaborationModeListParams,
  ) => Promise<v2.CollaborationModeListResponse>;

  /** Config APIs. */
  readConfig: (params: v2.ConfigReadParams) => Promise<v2.ConfigReadResponse>;
  writeConfigValue: (
    params: v2.ConfigValueWriteParams,
  ) => Promise<v2.ConfigWriteResponse>;
  writeConfigBatch: (
    params: v2.ConfigBatchWriteParams,
  ) => Promise<v2.ConfigWriteResponse>;
  readConfigRequirements: () => Promise<v2.ConfigRequirementsReadResponse>;

  /** Account + feedback flows. */
  readAccount: (params: v2.GetAccountParams) => Promise<v2.GetAccountResponse>;
  readAccountRateLimits: () => Promise<v2.GetAccountRateLimitsResponse>;
  startAccountLogin: (
    params: v2.LoginAccountParams,
  ) => Promise<v2.LoginAccountResponse>;
  cancelAccountLogin: (
    params: v2.CancelLoginAccountParams,
  ) => Promise<v2.CancelLoginAccountResponse>;
  logoutAccount: () => Promise<v2.LogoutAccountResponse>;
  uploadFeedback: (
    params: v2.FeedbackUploadParams,
  ) => Promise<v2.FeedbackUploadResponse>;

  /** MCP status + auth flows. */
  listMcpServerStatus: (
    params: v2.ListMcpServerStatusParams,
  ) => Promise<v2.ListMcpServerStatusResponse>;
  loginMcpServer: (
    params: v2.McpServerOauthLoginParams,
  ) => Promise<v2.McpServerOauthLoginResponse>;
  reloadMcpConfig: () => Promise<void>;

  /** Execute a one-off command outside thread/turn context. */
  execCommand: (
    params: v2.CommandExecParams,
  ) => Promise<v2.CommandExecResponse>;

  /** Approval + user-input responses. */
  approveCommandExecution: (
    requestId: RequestId,
    decision: v2.CommandExecutionApprovalDecision,
  ) => Promise<void>;
  approveFileChange: (
    requestId: RequestId,
    decision: v2.FileChangeApprovalDecision,
  ) => Promise<void>;
  respondUserInput: (
    requestId: RequestId,
    answers: v2.ToolRequestUserInputResponse["answers"],
  ) => Promise<void>;
  approveApplyPatch: (
    requestId: RequestId,
    decision: ApplyPatchApprovalResponse["decision"],
  ) => Promise<void>;
  approveExecCommand: (
    requestId: RequestId,
    decision: ExecCommandApprovalResponse["decision"],
  ) => Promise<void>;
};

/**
 * Create a Codex app-server bridge bound to a single JSON-RPC client instance.
 *
 * @param options - Client configuration for the app-server process.
 * @returns Bridge helpers that wrap the JSON-RPC client.
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export function createCodexAppServerBridge(
  options: CodexAppServerClientOptions = {},
): CodexAppServerBridge {
  const client = new CodexAppServerClient(options);

  return {
    client,
    ensureStarted: () => client.ensureStarted(),
    close: () => client.close(),
    onNotification: (listener) => client.onNotification(listener),
    onServerRequest: (listener) => client.onServerRequest(listener),
    startThread: (params) => client.threadStart(params),
    resumeThread: (params) => client.threadResume(params),
    forkThread: (params) => client.threadFork(params),
    readThread: (params) => client.threadRead(params),
    listThreads: (params) => client.threadList(params),
    listLoadedThreads: (params) => client.threadLoadedList(params),
    archiveThread: (params) => client.threadArchive(params),
    rollbackThread: (params) => client.threadRollback(params),
    startTurn: (params) => client.turnStart(params),
    interruptTurn: (params) => client.turnInterrupt(params),
    startReview: (params) => client.reviewStart(params),
    listModels: (params) => client.modelList(params),
    listSkills: (params) => client.skillsList(params),
    writeSkillConfig: (params) => client.skillsConfigWrite(params),
    listCollaborationModes: (params) => client.collaborationModeList(params),
    readConfig: (params) => client.configRead(params),
    writeConfigValue: (params) => client.configValueWrite(params),
    writeConfigBatch: (params) => client.configBatchWrite(params),
    readConfigRequirements: () => client.configRequirementsRead(),
    readAccount: (params) => client.accountRead(params),
    readAccountRateLimits: () => client.accountRateLimitsRead(),
    startAccountLogin: (params) => client.accountLoginStart(params),
    cancelAccountLogin: (params) => client.accountLoginCancel(params),
    logoutAccount: () => client.accountLogout(),
    uploadFeedback: (params) => client.feedbackUpload(params),
    listMcpServerStatus: (params) => client.mcpServerStatusList(params),
    loginMcpServer: (params) => client.mcpServerOauthLogin(params),
    reloadMcpConfig: () => client.configMcpServerReload(),
    execCommand: (params) => client.commandExec(params),
    approveCommandExecution: (requestId, decision) =>
      client.respondToCommandExecutionApproval(requestId, decision),
    approveFileChange: (requestId, decision) =>
      client.respondToFileChangeApproval(requestId, decision),
    respondUserInput: (requestId, answers) =>
      client.respondToToolRequestUserInput(requestId, answers),
    approveApplyPatch: (requestId, decision) =>
      client.respondToApplyPatchApproval(requestId, decision),
    approveExecCommand: (requestId, decision) =>
      client.respondToExecCommandApproval(requestId, decision),
  };
}
