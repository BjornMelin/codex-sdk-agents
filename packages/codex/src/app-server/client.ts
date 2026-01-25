import type {
  ApplyPatchApprovalResponse,
  ClientInfo,
  ExecCommandApprovalResponse,
  RequestId,
  ServerNotification,
  ServerRequest,
  v2,
} from "@codex-toolloop/codex-app-server-protocol";

import { type CodexAppServerLogger, CodexAppServerProcess } from "./process.js";

/**
 * Options for the Codex app-server JSONL client.
 *
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export type CodexAppServerClientOptions = {
  codexPath?: string | undefined;
  cwd?: string | undefined;
  env?: Record<string, string> | undefined;
  logger?: CodexAppServerLogger | false | undefined;
  requestTimeoutMs?: number | undefined;
  clientInfo?: ClientInfo | undefined;
};

/**
 * Typed client for Codex app-server JSON-RPC v2.
 *
 * @see docs/specs/023-codex-app-server-protocol.md
 */
export class CodexAppServerClient {
  private readonly process: CodexAppServerProcess;

  public constructor(options: CodexAppServerClientOptions = {}) {
    this.process = new CodexAppServerProcess(options);
  }

  public async ensureStarted(): Promise<void> {
    await this.process.ensureStarted();
  }

  public async close(): Promise<void> {
    await this.process.close();
  }

  public onNotification(
    listener: (notification: ServerNotification) => void,
  ): () => void {
    return this.process.onNotification(listener);
  }

  public onServerRequest(
    listener: (request: ServerRequest) => void,
  ): () => void {
    return this.process.onServerRequest(listener);
  }

  public async sendResponse(
    requestId: RequestId,
    result: unknown,
  ): Promise<void> {
    await this.process.sendResponse(requestId, result);
  }

  public async sendError(
    requestId: RequestId,
    error: { code: number; message: string; data?: unknown },
  ): Promise<void> {
    await this.process.sendError(requestId, error);
  }

  public async respondToCommandExecutionApproval(
    requestId: RequestId,
    decision: v2.CommandExecutionApprovalDecision,
  ): Promise<void> {
    const response: v2.CommandExecutionRequestApprovalResponse = { decision };
    await this.process.sendResponse(requestId, response);
  }

  public async respondToFileChangeApproval(
    requestId: RequestId,
    decision: v2.FileChangeApprovalDecision,
  ): Promise<void> {
    const response: v2.FileChangeRequestApprovalResponse = { decision };
    await this.process.sendResponse(requestId, response);
  }

  public async respondToToolRequestUserInput(
    requestId: RequestId,
    answers: v2.ToolRequestUserInputResponse["answers"],
  ): Promise<void> {
    const response: v2.ToolRequestUserInputResponse = { answers };
    await this.process.sendResponse(requestId, response);
  }

  public async respondToApplyPatchApproval(
    requestId: RequestId,
    decision: ApplyPatchApprovalResponse["decision"],
  ): Promise<void> {
    const response: ApplyPatchApprovalResponse = { decision };
    await this.process.sendResponse(requestId, response);
  }

  public async respondToExecCommandApproval(
    requestId: RequestId,
    decision: ExecCommandApprovalResponse["decision"],
  ): Promise<void> {
    const response: ExecCommandApprovalResponse = { decision };
    await this.process.sendResponse(requestId, response);
  }

  public async threadStart(
    params: v2.ThreadStartParams,
  ): Promise<v2.ThreadStartResponse> {
    return await this.process.request("thread/start", params);
  }

  public async threadResume(
    params: v2.ThreadResumeParams,
  ): Promise<v2.ThreadResumeResponse> {
    return await this.process.request("thread/resume", params);
  }

  public async threadFork(
    params: v2.ThreadForkParams,
  ): Promise<v2.ThreadForkResponse> {
    return await this.process.request("thread/fork", params);
  }

  public async threadRead(
    params: v2.ThreadReadParams,
  ): Promise<v2.ThreadReadResponse> {
    return await this.process.request("thread/read", params);
  }

  public async threadList(
    params: v2.ThreadListParams,
  ): Promise<v2.ThreadListResponse> {
    return await this.process.request("thread/list", params);
  }

  public async threadLoadedList(
    params: v2.ThreadLoadedListParams,
  ): Promise<v2.ThreadLoadedListResponse> {
    return await this.process.request("thread/loaded/list", params);
  }

  public async threadArchive(
    params: v2.ThreadArchiveParams,
  ): Promise<v2.ThreadArchiveResponse> {
    return await this.process.request("thread/archive", params);
  }

  public async threadRollback(
    params: v2.ThreadRollbackParams,
  ): Promise<v2.ThreadRollbackResponse> {
    return await this.process.request("thread/rollback", params);
  }

  public async turnStart(
    params: v2.TurnStartParams,
  ): Promise<v2.TurnStartResponse> {
    return await this.process.request("turn/start", params);
  }

  public async turnInterrupt(
    params: v2.TurnInterruptParams,
  ): Promise<v2.TurnInterruptResponse> {
    return await this.process.request("turn/interrupt", params);
  }

  public async reviewStart(
    params: v2.ReviewStartParams,
  ): Promise<v2.ReviewStartResponse> {
    return await this.process.request("review/start", params);
  }

  public async modelList(
    params: v2.ModelListParams,
  ): Promise<v2.ModelListResponse> {
    return await this.process.request("model/list", params);
  }

  public async collaborationModeList(
    params: v2.CollaborationModeListParams,
  ): Promise<v2.CollaborationModeListResponse> {
    return await this.process.request("collaborationMode/list", params);
  }

  public async skillsList(
    params: v2.SkillsListParams,
  ): Promise<v2.SkillsListResponse> {
    return await this.process.request("skills/list", params);
  }

  public async skillsConfigWrite(
    params: v2.SkillsConfigWriteParams,
  ): Promise<v2.SkillsConfigWriteResponse> {
    return await this.process.request("skills/config/write", params);
  }

  public async configRead(
    params: v2.ConfigReadParams,
  ): Promise<v2.ConfigReadResponse> {
    return await this.process.request("config/read", params);
  }

  public async configValueWrite(
    params: v2.ConfigValueWriteParams,
  ): Promise<v2.ConfigWriteResponse> {
    return await this.process.request("config/value/write", params);
  }

  public async configBatchWrite(
    params: v2.ConfigBatchWriteParams,
  ): Promise<v2.ConfigWriteResponse> {
    return await this.process.request("config/batchWrite", params);
  }

  public async configRequirementsRead(): Promise<v2.ConfigRequirementsReadResponse> {
    return await this.process.request("configRequirements/read", undefined);
  }

  public async accountRead(
    params: v2.GetAccountParams,
  ): Promise<v2.GetAccountResponse> {
    return await this.process.request("account/read", params);
  }

  public async accountRateLimitsRead(): Promise<v2.GetAccountRateLimitsResponse> {
    return await this.process.request("account/rateLimits/read", undefined);
  }

  public async accountLoginStart(
    params: v2.LoginAccountParams,
  ): Promise<v2.LoginAccountResponse> {
    return await this.process.request("account/login/start", params);
  }

  public async accountLoginCancel(
    params: v2.CancelLoginAccountParams,
  ): Promise<v2.CancelLoginAccountResponse> {
    return await this.process.request("account/login/cancel", params);
  }

  public async accountLogout(): Promise<v2.LogoutAccountResponse> {
    return await this.process.request("account/logout", undefined);
  }

  public async feedbackUpload(
    params: v2.FeedbackUploadParams,
  ): Promise<v2.FeedbackUploadResponse> {
    return await this.process.request("feedback/upload", params);
  }

  public async mcpServerOauthLogin(
    params: v2.McpServerOauthLoginParams,
  ): Promise<v2.McpServerOauthLoginResponse> {
    return await this.process.request("mcpServer/oauth/login", params);
  }

  public async configMcpServerReload(): Promise<void> {
    await this.process.request("config/mcpServer/reload", undefined);
  }

  public async mcpServerStatusList(
    params: v2.ListMcpServerStatusParams,
  ): Promise<v2.ListMcpServerStatusResponse> {
    return await this.process.request("mcpServerStatus/list", params);
  }

  public async commandExec(
    params: v2.CommandExecParams,
  ): Promise<v2.CommandExecResponse> {
    return await this.process.request("command/exec", params);
  }
}
