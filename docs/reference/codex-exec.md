This file is a merged representation of a subset of the codebase, containing specifically included files and files not matching ignore patterns, combined into a single document by Repomix.

<file_summary>
This section contains a summary of this file.

<purpose>
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.
</purpose>

<file_format>
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  - File path as an attribute
  - Full contents of the file
</file_format>

<usage_guidelines>
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.
</usage_guidelines>

<notes>
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: codex-rs/exec/
- Files matching these patterns are excluded: **/tests/*
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)
</notes>

</file_summary>

<directory_structure>
codex-rs/
  exec/
    src/
      cli.rs
      event_processor_with_human_output.rs
      event_processor_with_jsonl_output.rs
      event_processor.rs
      exec_events.rs
      lib.rs
      main.rs
    tests/
      all.rs
      event_processor_with_json_output.rs
    BUILD.bazel
    Cargo.toml
</directory_structure>

<files>
This section contains the contents of the repository's files.

<file path="codex-rs/exec/src/cli.rs">
use clap::Parser;
use clap::ValueEnum;
use codex_common::CliConfigOverrides;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(version)]
pub struct Cli {
    /// Action to perform. If omitted, runs a new non-interactive session.
    #[command(subcommand)]
    pub command: Option<Command>,

    /// Optional image(s) to attach to the initial prompt.
    #[arg(
        long = "image",
        short = 'i',
        value_name = "FILE",
        value_delimiter = ',',
        num_args = 1..
    )]
    pub images: Vec<PathBuf>,

    /// Model the agent should use.
    #[arg(long, short = 'm', global = true)]
    pub model: Option<String>,

    /// Use open-source provider.
    #[arg(long = "oss", default_value_t = false)]
    pub oss: bool,

    /// Specify which local provider to use (lmstudio, ollama, or ollama-chat).
    /// If not specified with --oss, will use config default or show selection.
    #[arg(long = "local-provider")]
    pub oss_provider: Option<String>,

    /// Select the sandbox policy to use when executing model-generated shell
    /// commands.
    #[arg(long = "sandbox", short = 's', value_enum)]
    pub sandbox_mode: Option<codex_common::SandboxModeCliArg>,

    /// Configuration profile from config.toml to specify default options.
    #[arg(long = "profile", short = 'p')]
    pub config_profile: Option<String>,

    /// Convenience alias for low-friction sandboxed automatic execution (-a on-request, --sandbox workspace-write).
    #[arg(long = "full-auto", default_value_t = false, global = true)]
    pub full_auto: bool,

    /// Skip all confirmation prompts and execute commands without sandboxing.
    /// EXTREMELY DANGEROUS. Intended solely for running in environments that are externally sandboxed.
    #[arg(
        long = "dangerously-bypass-approvals-and-sandbox",
        alias = "yolo",
        default_value_t = false,
        global = true,
        conflicts_with = "full_auto"
    )]
    pub dangerously_bypass_approvals_and_sandbox: bool,

    /// Tell the agent to use the specified directory as its working root.
    #[clap(long = "cd", short = 'C', value_name = "DIR")]
    pub cwd: Option<PathBuf>,

    /// Allow running Codex outside a Git repository.
    #[arg(long = "skip-git-repo-check", global = true, default_value_t = false)]
    pub skip_git_repo_check: bool,

    /// Additional directories that should be writable alongside the primary workspace.
    #[arg(long = "add-dir", value_name = "DIR", value_hint = clap::ValueHint::DirPath)]
    pub add_dir: Vec<PathBuf>,

    /// Path to a JSON Schema file describing the model's final response shape.
    #[arg(long = "output-schema", value_name = "FILE")]
    pub output_schema: Option<PathBuf>,

    #[clap(skip)]
    pub config_overrides: CliConfigOverrides,

    /// Specifies color settings for use in the output.
    #[arg(long = "color", value_enum, default_value_t = Color::Auto)]
    pub color: Color,

    /// Print events to stdout as JSONL.
    #[arg(
        long = "json",
        alias = "experimental-json",
        default_value_t = false,
        global = true
    )]
    pub json: bool,

    /// Specifies file where the last message from the agent should be written.
    #[arg(long = "output-last-message", short = 'o', value_name = "FILE")]
    pub last_message_file: Option<PathBuf>,

    /// Initial instructions for the agent. If not provided as an argument (or
    /// if `-` is used), instructions are read from stdin.
    #[arg(value_name = "PROMPT", value_hint = clap::ValueHint::Other)]
    pub prompt: Option<String>,
}

#[derive(Debug, clap::Subcommand)]
pub enum Command {
    /// Resume a previous session by id or pick the most recent with --last.
    Resume(ResumeArgs),

    /// Run a code review against the current repository.
    Review(ReviewArgs),
}

#[derive(Parser, Debug)]
pub struct ResumeArgs {
    /// Conversation/session id (UUID). When provided, resumes this session.
    /// If omitted, use --last to pick the most recent recorded session.
    #[arg(value_name = "SESSION_ID")]
    pub session_id: Option<String>,

    /// Resume the most recent recorded session (newest) without specifying an id.
    #[arg(long = "last", default_value_t = false)]
    pub last: bool,

    /// Show all sessions (disables cwd filtering).
    #[arg(long = "all", default_value_t = false)]
    pub all: bool,

    /// Optional image(s) to attach to the prompt sent after resuming.
    #[arg(
        long = "image",
        short = 'i',
        value_name = "FILE",
        value_delimiter = ',',
        num_args = 1
    )]
    pub images: Vec<PathBuf>,

    /// Prompt to send after resuming the session. If `-` is used, read from stdin.
    #[arg(value_name = "PROMPT", value_hint = clap::ValueHint::Other)]
    pub prompt: Option<String>,
}

#[derive(Parser, Debug)]
pub struct ReviewArgs {
    /// Review staged, unstaged, and untracked changes.
    #[arg(
        long = "uncommitted",
        default_value_t = false,
        conflicts_with_all = ["base", "commit", "prompt"]
    )]
    pub uncommitted: bool,

    /// Review changes against the given base branch.
    #[arg(
        long = "base",
        value_name = "BRANCH",
        conflicts_with_all = ["uncommitted", "commit", "prompt"]
    )]
    pub base: Option<String>,

    /// Review the changes introduced by a commit.
    #[arg(
        long = "commit",
        value_name = "SHA",
        conflicts_with_all = ["uncommitted", "base", "prompt"]
    )]
    pub commit: Option<String>,

    /// Optional commit title to display in the review summary.
    #[arg(long = "title", value_name = "TITLE", requires = "commit")]
    pub commit_title: Option<String>,

    /// Custom review instructions. If `-` is used, read from stdin.
    #[arg(value_name = "PROMPT", value_hint = clap::ValueHint::Other)]
    pub prompt: Option<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, ValueEnum)]
#[value(rename_all = "kebab-case")]
pub enum Color {
    Always,
    Never,
    #[default]
    Auto,
}
</file>

<file path="codex-rs/exec/src/event_processor_with_human_output.rs">
use codex_common::elapsed::format_duration;
use codex_common::elapsed::format_elapsed;
use codex_core::config::Config;
use codex_core::protocol::AgentMessageEvent;
use codex_core::protocol::AgentReasoningRawContentEvent;
use codex_core::protocol::BackgroundEventEvent;
use codex_core::protocol::DeprecationNoticeEvent;
use codex_core::protocol::ErrorEvent;
use codex_core::protocol::Event;
use codex_core::protocol::EventMsg;
use codex_core::protocol::ExecCommandBeginEvent;
use codex_core::protocol::ExecCommandEndEvent;
use codex_core::protocol::FileChange;
use codex_core::protocol::McpInvocation;
use codex_core::protocol::McpToolCallBeginEvent;
use codex_core::protocol::McpToolCallEndEvent;
use codex_core::protocol::PatchApplyBeginEvent;
use codex_core::protocol::PatchApplyEndEvent;
use codex_core::protocol::SessionConfiguredEvent;
use codex_core::protocol::StreamErrorEvent;
use codex_core::protocol::TurnAbortReason;
use codex_core::protocol::TurnCompleteEvent;
use codex_core::protocol::TurnDiffEvent;
use codex_core::protocol::WarningEvent;
use codex_core::protocol::WebSearchEndEvent;
use codex_protocol::num_format::format_with_separators;
use owo_colors::OwoColorize;
use owo_colors::Style;
use shlex::try_join;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;

use crate::event_processor::CodexStatus;
use crate::event_processor::EventProcessor;
use crate::event_processor::handle_last_message;
use codex_common::create_config_summary_entries;
use codex_protocol::plan_tool::StepStatus;
use codex_protocol::plan_tool::UpdatePlanArgs;

/// This should be configurable. When used in CI, users may not want to impose
/// a limit so they can see the full transcript.
const MAX_OUTPUT_LINES_FOR_EXEC_TOOL_CALL: usize = 20;
pub(crate) struct EventProcessorWithHumanOutput {
    call_id_to_patch: HashMap<String, PatchApplyBegin>,

    // To ensure that --color=never is respected, ANSI escapes _must_ be added
    // using .style() with one of these fields. If you need a new style, add a
    // new field here.
    bold: Style,
    italic: Style,
    dimmed: Style,

    magenta: Style,
    red: Style,
    green: Style,
    cyan: Style,
    yellow: Style,

    /// Whether to include `AgentReasoning` events in the output.
    show_agent_reasoning: bool,
    show_raw_agent_reasoning: bool,
    last_message_path: Option<PathBuf>,
    last_total_token_usage: Option<codex_core::protocol::TokenUsageInfo>,
    final_message: Option<String>,
}

impl EventProcessorWithHumanOutput {
    pub(crate) fn create_with_ansi(
        with_ansi: bool,
        config: &Config,
        last_message_path: Option<PathBuf>,
    ) -> Self {
        let call_id_to_patch = HashMap::new();

        if with_ansi {
            Self {
                call_id_to_patch,
                bold: Style::new().bold(),
                italic: Style::new().italic(),
                dimmed: Style::new().dimmed(),
                magenta: Style::new().magenta(),
                red: Style::new().red(),
                green: Style::new().green(),
                cyan: Style::new().cyan(),
                yellow: Style::new().yellow(),
                show_agent_reasoning: !config.hide_agent_reasoning,
                show_raw_agent_reasoning: config.show_raw_agent_reasoning,
                last_message_path,
                last_total_token_usage: None,
                final_message: None,
            }
        } else {
            Self {
                call_id_to_patch,
                bold: Style::new(),
                italic: Style::new(),
                dimmed: Style::new(),
                magenta: Style::new(),
                red: Style::new(),
                green: Style::new(),
                cyan: Style::new(),
                yellow: Style::new(),
                show_agent_reasoning: !config.hide_agent_reasoning,
                show_raw_agent_reasoning: config.show_raw_agent_reasoning,
                last_message_path,
                last_total_token_usage: None,
                final_message: None,
            }
        }
    }
}

struct PatchApplyBegin {
    start_time: Instant,
    auto_approved: bool,
}

/// Timestamped helper. The timestamp is styled with self.dimmed.
macro_rules! ts_msg {
    ($self:ident, $($arg:tt)*) => {{
        eprintln!($($arg)*);
    }};
}

impl EventProcessor for EventProcessorWithHumanOutput {
    /// Print a concise summary of the effective configuration that will be used
    /// for the session. This mirrors the information shown in the TUI welcome
    /// screen.
    fn print_config_summary(
        &mut self,
        config: &Config,
        prompt: &str,
        session_configured_event: &SessionConfiguredEvent,
    ) {
        const VERSION: &str = env!("CARGO_PKG_VERSION");
        ts_msg!(
            self,
            "OpenAI Codex v{} (research preview)\n--------",
            VERSION
        );

        let mut entries =
            create_config_summary_entries(config, session_configured_event.model.as_str());
        entries.push((
            "session id",
            session_configured_event.session_id.to_string(),
        ));

        for (key, value) in entries {
            eprintln!("{} {}", format!("{key}:").style(self.bold), value);
        }

        eprintln!("--------");

        // Echo the prompt that will be sent to the agent so it is visible in the
        // transcript/logs before any events come in. Note the prompt may have been
        // read from stdin, so it may not be visible in the terminal otherwise.
        ts_msg!(self, "{}\n{}", "user".style(self.cyan), prompt);
    }

    fn process_event(&mut self, event: Event) -> CodexStatus {
        let Event { id: _, msg } = event;
        match msg {
            EventMsg::Error(ErrorEvent { message, .. }) => {
                let prefix = "ERROR:".style(self.red);
                ts_msg!(self, "{prefix} {message}");
            }
            EventMsg::Warning(WarningEvent { message }) => {
                ts_msg!(
                    self,
                    "{} {message}",
                    "warning:".style(self.yellow).style(self.bold)
                );
            }
            EventMsg::DeprecationNotice(DeprecationNoticeEvent { summary, details }) => {
                ts_msg!(
                    self,
                    "{} {summary}",
                    "deprecated:".style(self.magenta).style(self.bold)
                );
                if let Some(details) = details {
                    ts_msg!(self, "  {}", details.style(self.dimmed));
                }
            }
            EventMsg::McpStartupUpdate(update) => {
                let status_text = match update.status {
                    codex_core::protocol::McpStartupStatus::Starting => "starting".to_string(),
                    codex_core::protocol::McpStartupStatus::Ready => "ready".to_string(),
                    codex_core::protocol::McpStartupStatus::Cancelled => "cancelled".to_string(),
                    codex_core::protocol::McpStartupStatus::Failed { ref error } => {
                        format!("failed: {error}")
                    }
                };
                ts_msg!(
                    self,
                    "{} {} {}",
                    "mcp:".style(self.cyan),
                    update.server,
                    status_text
                );
            }
            EventMsg::McpStartupComplete(summary) => {
                let mut parts = Vec::new();
                if !summary.ready.is_empty() {
                    parts.push(format!("ready: {}", summary.ready.join(", ")));
                }
                if !summary.failed.is_empty() {
                    let servers: Vec<_> = summary.failed.iter().map(|f| f.server.clone()).collect();
                    parts.push(format!("failed: {}", servers.join(", ")));
                }
                if !summary.cancelled.is_empty() {
                    parts.push(format!("cancelled: {}", summary.cancelled.join(", ")));
                }
                let joined = if parts.is_empty() {
                    "no servers".to_string()
                } else {
                    parts.join("; ")
                };
                ts_msg!(self, "{} {}", "mcp startup:".style(self.cyan), joined);
            }
            EventMsg::BackgroundEvent(BackgroundEventEvent { message }) => {
                ts_msg!(self, "{}", message.style(self.dimmed));
            }
            EventMsg::StreamError(StreamErrorEvent {
                message,
                additional_details,
                ..
            }) => {
                let message = match additional_details {
                    Some(details) if !details.trim().is_empty() => format!("{message} ({details})"),
                    _ => message,
                };
                ts_msg!(self, "{}", message.style(self.dimmed));
            }
            EventMsg::TurnStarted(_) => {
                // Ignore.
            }
            EventMsg::ElicitationRequest(ev) => {
                ts_msg!(
                    self,
                    "{} {}",
                    "elicitation request".style(self.magenta),
                    ev.server_name.style(self.dimmed)
                );
                ts_msg!(
                    self,
                    "{}",
                    "auto-cancelling (not supported in exec mode)".style(self.dimmed)
                );
            }
            EventMsg::TurnComplete(TurnCompleteEvent { last_agent_message }) => {
                let last_message = last_agent_message.as_deref();
                if let Some(output_file) = self.last_message_path.as_deref() {
                    handle_last_message(last_message, output_file);
                }

                self.final_message = last_agent_message;

                return CodexStatus::InitiateShutdown;
            }
            EventMsg::TokenCount(ev) => {
                self.last_total_token_usage = ev.info;
            }

            EventMsg::AgentReasoningSectionBreak(_) => {
                if !self.show_agent_reasoning {
                    return CodexStatus::Running;
                }
                eprintln!();
            }
            EventMsg::AgentReasoningRawContent(AgentReasoningRawContentEvent { text }) => {
                if self.show_raw_agent_reasoning {
                    ts_msg!(
                        self,
                        "{}\n{}",
                        "thinking".style(self.italic).style(self.magenta),
                        text,
                    );
                }
            }
            EventMsg::AgentMessage(AgentMessageEvent { message }) => {
                ts_msg!(
                    self,
                    "{}\n{}",
                    "codex".style(self.italic).style(self.magenta),
                    message,
                );
            }
            EventMsg::ExecCommandBegin(ExecCommandBeginEvent { command, cwd, .. }) => {
                eprint!(
                    "{}\n{} in {}",
                    "exec".style(self.italic).style(self.magenta),
                    escape_command(&command).style(self.bold),
                    cwd.to_string_lossy(),
                );
            }
            EventMsg::ExecCommandEnd(ExecCommandEndEvent {
                aggregated_output,
                duration,
                exit_code,
                ..
            }) => {
                let duration = format!(" in {}", format_duration(duration));

                let truncated_output = aggregated_output
                    .lines()
                    .take(MAX_OUTPUT_LINES_FOR_EXEC_TOOL_CALL)
                    .collect::<Vec<_>>()
                    .join("\n");
                match exit_code {
                    0 => {
                        let title = format!(" succeeded{duration}:");
                        ts_msg!(self, "{}", title.style(self.green));
                    }
                    _ => {
                        let title = format!(" exited {exit_code}{duration}:");
                        ts_msg!(self, "{}", title.style(self.red));
                    }
                }
                eprintln!("{}", truncated_output.style(self.dimmed));
            }
            EventMsg::McpToolCallBegin(McpToolCallBeginEvent {
                call_id: _,
                invocation,
            }) => {
                ts_msg!(
                    self,
                    "{} {}",
                    "tool".style(self.magenta),
                    format_mcp_invocation(&invocation).style(self.bold),
                );
            }
            EventMsg::McpToolCallEnd(tool_call_end_event) => {
                let is_success = tool_call_end_event.is_success();
                let McpToolCallEndEvent {
                    call_id: _,
                    result,
                    invocation,
                    duration,
                } = tool_call_end_event;

                let duration = format!(" in {}", format_duration(duration));

                let status_str = if is_success { "success" } else { "failed" };
                let title_style = if is_success { self.green } else { self.red };
                let title = format!(
                    "{} {status_str}{duration}:",
                    format_mcp_invocation(&invocation)
                );

                ts_msg!(self, "{}", title.style(title_style));

                if let Ok(res) = result {
                    let val: serde_json::Value = res.into();
                    let pretty =
                        serde_json::to_string_pretty(&val).unwrap_or_else(|_| val.to_string());

                    for line in pretty.lines().take(MAX_OUTPUT_LINES_FOR_EXEC_TOOL_CALL) {
                        eprintln!("{}", line.style(self.dimmed));
                    }
                }
            }
            EventMsg::WebSearchEnd(WebSearchEndEvent { call_id: _, query }) => {
                ts_msg!(self, "🌐 Searched: {query}");
            }
            EventMsg::PatchApplyBegin(PatchApplyBeginEvent {
                call_id,
                auto_approved,
                changes,
                ..
            }) => {
                // Store metadata so we can calculate duration later when we
                // receive the corresponding PatchApplyEnd event.
                self.call_id_to_patch.insert(
                    call_id,
                    PatchApplyBegin {
                        start_time: Instant::now(),
                        auto_approved,
                    },
                );

                ts_msg!(
                    self,
                    "{}",
                    "file update".style(self.magenta).style(self.italic),
                );

                // Pretty-print the patch summary with colored diff markers so
                // it's easy to scan in the terminal output.
                for (path, change) in changes.iter() {
                    match change {
                        FileChange::Add { content } => {
                            let header = format!(
                                "{} {}",
                                format_file_change(change),
                                path.to_string_lossy()
                            );
                            eprintln!("{}", header.style(self.magenta));
                            for line in content.lines() {
                                eprintln!("{}", line.style(self.green));
                            }
                        }
                        FileChange::Delete { content } => {
                            let header = format!(
                                "{} {}",
                                format_file_change(change),
                                path.to_string_lossy()
                            );
                            eprintln!("{}", header.style(self.magenta));
                            for line in content.lines() {
                                eprintln!("{}", line.style(self.red));
                            }
                        }
                        FileChange::Update {
                            unified_diff,
                            move_path,
                        } => {
                            let header = if let Some(dest) = move_path {
                                format!(
                                    "{} {} -> {}",
                                    format_file_change(change),
                                    path.to_string_lossy(),
                                    dest.to_string_lossy()
                                )
                            } else {
                                format!("{} {}", format_file_change(change), path.to_string_lossy())
                            };
                            eprintln!("{}", header.style(self.magenta));

                            // Colorize diff lines. We keep file header lines
                            // (--- / +++) without extra coloring so they are
                            // still readable.
                            for diff_line in unified_diff.lines() {
                                if diff_line.starts_with('+') && !diff_line.starts_with("+++") {
                                    eprintln!("{}", diff_line.style(self.green));
                                } else if diff_line.starts_with('-')
                                    && !diff_line.starts_with("---")
                                {
                                    eprintln!("{}", diff_line.style(self.red));
                                } else {
                                    eprintln!("{diff_line}");
                                }
                            }
                        }
                    }
                }
            }
            EventMsg::PatchApplyEnd(PatchApplyEndEvent {
                call_id,
                stdout,
                stderr,
                success,
                ..
            }) => {
                let patch_begin = self.call_id_to_patch.remove(&call_id);

                // Compute duration and summary label similar to exec commands.
                let (duration, label) = if let Some(PatchApplyBegin {
                    start_time,
                    auto_approved,
                }) = patch_begin
                {
                    (
                        format!(" in {}", format_elapsed(start_time)),
                        format!("apply_patch(auto_approved={auto_approved})"),
                    )
                } else {
                    (String::new(), format!("apply_patch('{call_id}')"))
                };

                let (exit_code, output, title_style) = if success {
                    (0, stdout, self.green)
                } else {
                    (1, stderr, self.red)
                };

                let title = format!("{label} exited {exit_code}{duration}:");
                ts_msg!(self, "{}", title.style(title_style));
                for line in output.lines() {
                    eprintln!("{}", line.style(self.dimmed));
                }
            }
            EventMsg::TurnDiff(TurnDiffEvent { unified_diff }) => {
                ts_msg!(
                    self,
                    "{}",
                    "file update:".style(self.magenta).style(self.italic)
                );
                eprintln!("{unified_diff}");
            }
            EventMsg::AgentReasoning(agent_reasoning_event) => {
                if self.show_agent_reasoning {
                    ts_msg!(
                        self,
                        "{}\n{}",
                        "thinking".style(self.italic).style(self.magenta),
                        agent_reasoning_event.text,
                    );
                }
            }
            EventMsg::SessionConfigured(session_configured_event) => {
                let SessionConfiguredEvent {
                    session_id: conversation_id,
                    model,
                    ..
                } = session_configured_event;

                ts_msg!(
                    self,
                    "{} {}",
                    "codex session".style(self.magenta).style(self.bold),
                    conversation_id.to_string().style(self.dimmed)
                );

                ts_msg!(self, "model: {}", model);
                eprintln!();
            }
            EventMsg::PlanUpdate(plan_update_event) => {
                let UpdatePlanArgs { explanation, plan } = plan_update_event;

                // Header
                ts_msg!(self, "{}", "Plan update".style(self.magenta));

                // Optional explanation
                if let Some(explanation) = explanation
                    && !explanation.trim().is_empty()
                {
                    ts_msg!(self, "{}", explanation.style(self.italic));
                }

                // Pretty-print the plan items with simple status markers.
                for item in plan {
                    match item.status {
                        StepStatus::Completed => {
                            ts_msg!(self, "  {} {}", "✓".style(self.green), item.step);
                        }
                        StepStatus::InProgress => {
                            ts_msg!(self, "  {} {}", "→".style(self.cyan), item.step);
                        }
                        StepStatus::Pending => {
                            ts_msg!(
                                self,
                                "  {} {}",
                                "•".style(self.dimmed),
                                item.step.style(self.dimmed)
                            );
                        }
                    }
                }
            }
            EventMsg::ViewImageToolCall(view) => {
                ts_msg!(
                    self,
                    "{} {}",
                    "viewed image".style(self.magenta),
                    view.path.display()
                );
            }
            EventMsg::TurnAborted(abort_reason) => match abort_reason.reason {
                TurnAbortReason::Interrupted => {
                    ts_msg!(self, "task interrupted");
                }
                TurnAbortReason::Replaced => {
                    ts_msg!(self, "task aborted: replaced by a new task");
                }
                TurnAbortReason::ReviewEnded => {
                    ts_msg!(self, "task aborted: review ended");
                }
            },
            EventMsg::ContextCompacted(_) => {
                ts_msg!(self, "context compacted");
            }
            EventMsg::CollabAgentSpawnBegin(_)
            | EventMsg::CollabAgentSpawnEnd(_)
            | EventMsg::CollabAgentInteractionBegin(_)
            | EventMsg::CollabAgentInteractionEnd(_)
            | EventMsg::CollabWaitingBegin(_)
            | EventMsg::CollabWaitingEnd(_)
            | EventMsg::CollabCloseBegin(_)
            | EventMsg::CollabCloseEnd(_) => {
                // TODO(jif) handle collab tools.
            }
            EventMsg::ShutdownComplete => return CodexStatus::Shutdown,
            EventMsg::WebSearchBegin(_)
            | EventMsg::ExecApprovalRequest(_)
            | EventMsg::ApplyPatchApprovalRequest(_)
            | EventMsg::TerminalInteraction(_)
            | EventMsg::ExecCommandOutputDelta(_)
            | EventMsg::GetHistoryEntryResponse(_)
            | EventMsg::McpListToolsResponse(_)
            | EventMsg::ListCustomPromptsResponse(_)
            | EventMsg::ListSkillsResponse(_)
            | EventMsg::RawResponseItem(_)
            | EventMsg::UserMessage(_)
            | EventMsg::EnteredReviewMode(_)
            | EventMsg::ExitedReviewMode(_)
            | EventMsg::AgentMessageDelta(_)
            | EventMsg::AgentReasoningDelta(_)
            | EventMsg::AgentReasoningRawContentDelta(_)
            | EventMsg::ItemStarted(_)
            | EventMsg::ItemCompleted(_)
            | EventMsg::AgentMessageContentDelta(_)
            | EventMsg::ReasoningContentDelta(_)
            | EventMsg::ReasoningRawContentDelta(_)
            | EventMsg::SkillsUpdateAvailable
            | EventMsg::UndoCompleted(_)
            | EventMsg::UndoStarted(_)
            | EventMsg::ThreadRolledBack(_)
            | EventMsg::RequestUserInput(_) => {}
        }
        CodexStatus::Running
    }

    fn print_final_output(&mut self) {
        if let Some(usage_info) = &self.last_total_token_usage {
            eprintln!(
                "{}\n{}",
                "tokens used".style(self.magenta).style(self.italic),
                format_with_separators(usage_info.total_token_usage.blended_total())
            );
        }

        // If the user has not piped the final message to a file, they will see
        // it twice: once written to stderr as part of the normal event
        // processing, and once here on stdout. We print the token summary above
        // to help break up the output visually in that case.
        #[allow(clippy::print_stdout)]
        if let Some(message) = &self.final_message {
            if message.ends_with('\n') {
                print!("{message}");
            } else {
                println!("{message}");
            }
        }
    }
}

fn escape_command(command: &[String]) -> String {
    try_join(command.iter().map(String::as_str)).unwrap_or_else(|_| command.join(" "))
}

fn format_file_change(change: &FileChange) -> &'static str {
    match change {
        FileChange::Add { .. } => "A",
        FileChange::Delete { .. } => "D",
        FileChange::Update {
            move_path: Some(_), ..
        } => "R",
        FileChange::Update {
            move_path: None, ..
        } => "M",
    }
}

fn format_mcp_invocation(invocation: &McpInvocation) -> String {
    // Build fully-qualified tool name: server.tool
    let fq_tool_name = format!("{}.{}", invocation.server, invocation.tool);

    // Format arguments as compact JSON so they fit on one line.
    let args_str = invocation
        .arguments
        .as_ref()
        .map(|v: &serde_json::Value| serde_json::to_string(v).unwrap_or_else(|_| v.to_string()))
        .unwrap_or_default();

    if args_str.is_empty() {
        format!("{fq_tool_name}()")
    } else {
        format!("{fq_tool_name}({args_str})")
    }
}
</file>

<file path="codex-rs/exec/src/event_processor_with_jsonl_output.rs">
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicU64;

use crate::event_processor::CodexStatus;
use crate::event_processor::EventProcessor;
use crate::event_processor::handle_last_message;
use crate::exec_events::AgentMessageItem;
use crate::exec_events::CommandExecutionItem;
use crate::exec_events::CommandExecutionStatus;
use crate::exec_events::ErrorItem;
use crate::exec_events::FileChangeItem;
use crate::exec_events::FileUpdateChange;
use crate::exec_events::ItemCompletedEvent;
use crate::exec_events::ItemStartedEvent;
use crate::exec_events::ItemUpdatedEvent;
use crate::exec_events::McpToolCallItem;
use crate::exec_events::McpToolCallItemError;
use crate::exec_events::McpToolCallItemResult;
use crate::exec_events::McpToolCallStatus;
use crate::exec_events::PatchApplyStatus;
use crate::exec_events::PatchChangeKind;
use crate::exec_events::ReasoningItem;
use crate::exec_events::ThreadErrorEvent;
use crate::exec_events::ThreadEvent;
use crate::exec_events::ThreadItem;
use crate::exec_events::ThreadItemDetails;
use crate::exec_events::ThreadStartedEvent;
use crate::exec_events::TodoItem;
use crate::exec_events::TodoListItem;
use crate::exec_events::TurnCompletedEvent;
use crate::exec_events::TurnFailedEvent;
use crate::exec_events::TurnStartedEvent;
use crate::exec_events::Usage;
use crate::exec_events::WebSearchItem;
use codex_core::config::Config;
use codex_core::protocol;
use codex_protocol::plan_tool::StepStatus;
use codex_protocol::plan_tool::UpdatePlanArgs;
use serde_json::Value as JsonValue;
use tracing::error;
use tracing::warn;

pub struct EventProcessorWithJsonOutput {
    last_message_path: Option<PathBuf>,
    next_event_id: AtomicU64,
    // Tracks running commands by call_id, including the associated item id.
    running_commands: HashMap<String, RunningCommand>,
    running_patch_applies: HashMap<String, protocol::PatchApplyBeginEvent>,
    // Tracks the todo list for the current turn (at most one per turn).
    running_todo_list: Option<RunningTodoList>,
    last_total_token_usage: Option<codex_core::protocol::TokenUsage>,
    running_mcp_tool_calls: HashMap<String, RunningMcpToolCall>,
    last_critical_error: Option<ThreadErrorEvent>,
}

#[derive(Debug, Clone)]
struct RunningCommand {
    command: String,
    item_id: String,
    aggregated_output: String,
}

#[derive(Debug, Clone)]
struct RunningTodoList {
    item_id: String,
    items: Vec<TodoItem>,
}

#[derive(Debug, Clone)]
struct RunningMcpToolCall {
    server: String,
    tool: String,
    item_id: String,
    arguments: JsonValue,
}

impl EventProcessorWithJsonOutput {
    pub fn new(last_message_path: Option<PathBuf>) -> Self {
        Self {
            last_message_path,
            next_event_id: AtomicU64::new(0),
            running_commands: HashMap::new(),
            running_patch_applies: HashMap::new(),
            running_todo_list: None,
            last_total_token_usage: None,
            running_mcp_tool_calls: HashMap::new(),
            last_critical_error: None,
        }
    }

    pub fn collect_thread_events(&mut self, event: &protocol::Event) -> Vec<ThreadEvent> {
        match &event.msg {
            protocol::EventMsg::SessionConfigured(ev) => self.handle_session_configured(ev),
            protocol::EventMsg::AgentMessage(ev) => self.handle_agent_message(ev),
            protocol::EventMsg::AgentReasoning(ev) => self.handle_reasoning_event(ev),
            protocol::EventMsg::ExecCommandBegin(ev) => self.handle_exec_command_begin(ev),
            protocol::EventMsg::ExecCommandEnd(ev) => self.handle_exec_command_end(ev),
            protocol::EventMsg::TerminalInteraction(ev) => self.handle_terminal_interaction(ev),
            protocol::EventMsg::ExecCommandOutputDelta(ev) => {
                self.handle_output_chunk(&ev.call_id, &ev.chunk)
            }
            protocol::EventMsg::McpToolCallBegin(ev) => self.handle_mcp_tool_call_begin(ev),
            protocol::EventMsg::McpToolCallEnd(ev) => self.handle_mcp_tool_call_end(ev),
            protocol::EventMsg::PatchApplyBegin(ev) => self.handle_patch_apply_begin(ev),
            protocol::EventMsg::PatchApplyEnd(ev) => self.handle_patch_apply_end(ev),
            protocol::EventMsg::WebSearchBegin(_) => Vec::new(),
            protocol::EventMsg::WebSearchEnd(ev) => self.handle_web_search_end(ev),
            protocol::EventMsg::TokenCount(ev) => {
                if let Some(info) = &ev.info {
                    self.last_total_token_usage = Some(info.total_token_usage.clone());
                }
                Vec::new()
            }
            protocol::EventMsg::TurnStarted(ev) => self.handle_task_started(ev),
            protocol::EventMsg::TurnComplete(_) => self.handle_task_complete(),
            protocol::EventMsg::Error(ev) => {
                let error = ThreadErrorEvent {
                    message: ev.message.clone(),
                };
                self.last_critical_error = Some(error.clone());
                vec![ThreadEvent::Error(error)]
            }
            protocol::EventMsg::Warning(ev) => {
                let item = ThreadItem {
                    id: self.get_next_item_id(),
                    details: ThreadItemDetails::Error(ErrorItem {
                        message: ev.message.clone(),
                    }),
                };
                vec![ThreadEvent::ItemCompleted(ItemCompletedEvent { item })]
            }
            protocol::EventMsg::StreamError(ev) => {
                let message = match &ev.additional_details {
                    Some(details) if !details.trim().is_empty() => {
                        format!("{} ({})", ev.message, details)
                    }
                    _ => ev.message.clone(),
                };
                vec![ThreadEvent::Error(ThreadErrorEvent { message })]
            }
            protocol::EventMsg::PlanUpdate(ev) => self.handle_plan_update(ev),
            _ => Vec::new(),
        }
    }

    fn get_next_item_id(&self) -> String {
        format!(
            "item_{}",
            self.next_event_id
                .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        )
    }

    fn handle_session_configured(
        &self,
        payload: &protocol::SessionConfiguredEvent,
    ) -> Vec<ThreadEvent> {
        vec![ThreadEvent::ThreadStarted(ThreadStartedEvent {
            thread_id: payload.session_id.to_string(),
        })]
    }

    fn handle_web_search_end(&self, ev: &protocol::WebSearchEndEvent) -> Vec<ThreadEvent> {
        let item = ThreadItem {
            id: self.get_next_item_id(),
            details: ThreadItemDetails::WebSearch(WebSearchItem {
                query: ev.query.clone(),
            }),
        };

        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent { item })]
    }

    fn handle_output_chunk(&mut self, _call_id: &str, _chunk: &[u8]) -> Vec<ThreadEvent> {
        //TODO see how we want to process them
        vec![]
    }

    fn handle_terminal_interaction(
        &mut self,
        _ev: &protocol::TerminalInteractionEvent,
    ) -> Vec<ThreadEvent> {
        //TODO see how we want to process them
        vec![]
    }

    fn handle_agent_message(&self, payload: &protocol::AgentMessageEvent) -> Vec<ThreadEvent> {
        let item = ThreadItem {
            id: self.get_next_item_id(),

            details: ThreadItemDetails::AgentMessage(AgentMessageItem {
                text: payload.message.clone(),
            }),
        };

        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent { item })]
    }

    fn handle_reasoning_event(&self, ev: &protocol::AgentReasoningEvent) -> Vec<ThreadEvent> {
        let item = ThreadItem {
            id: self.get_next_item_id(),

            details: ThreadItemDetails::Reasoning(ReasoningItem {
                text: ev.text.clone(),
            }),
        };

        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent { item })]
    }
    fn handle_exec_command_begin(
        &mut self,
        ev: &protocol::ExecCommandBeginEvent,
    ) -> Vec<ThreadEvent> {
        let item_id = self.get_next_item_id();

        let command_string = match shlex::try_join(ev.command.iter().map(String::as_str)) {
            Ok(command_string) => command_string,
            Err(e) => {
                warn!(
                    call_id = ev.call_id,
                    "Failed to stringify command: {e:?}; skipping item.started"
                );
                ev.command.join(" ")
            }
        };

        self.running_commands.insert(
            ev.call_id.clone(),
            RunningCommand {
                command: command_string.clone(),
                item_id: item_id.clone(),
                aggregated_output: String::new(),
            },
        );

        let item = ThreadItem {
            id: item_id,
            details: ThreadItemDetails::CommandExecution(CommandExecutionItem {
                command: command_string,
                aggregated_output: String::new(),
                exit_code: None,
                status: CommandExecutionStatus::InProgress,
            }),
        };

        vec![ThreadEvent::ItemStarted(ItemStartedEvent { item })]
    }

    fn handle_mcp_tool_call_begin(
        &mut self,
        ev: &protocol::McpToolCallBeginEvent,
    ) -> Vec<ThreadEvent> {
        let item_id = self.get_next_item_id();
        let server = ev.invocation.server.clone();
        let tool = ev.invocation.tool.clone();
        let arguments = ev.invocation.arguments.clone().unwrap_or(JsonValue::Null);

        self.running_mcp_tool_calls.insert(
            ev.call_id.clone(),
            RunningMcpToolCall {
                server: server.clone(),
                tool: tool.clone(),
                item_id: item_id.clone(),
                arguments: arguments.clone(),
            },
        );

        let item = ThreadItem {
            id: item_id,
            details: ThreadItemDetails::McpToolCall(McpToolCallItem {
                server,
                tool,
                arguments,
                result: None,
                error: None,
                status: McpToolCallStatus::InProgress,
            }),
        };

        vec![ThreadEvent::ItemStarted(ItemStartedEvent { item })]
    }

    fn handle_mcp_tool_call_end(&mut self, ev: &protocol::McpToolCallEndEvent) -> Vec<ThreadEvent> {
        let status = if ev.is_success() {
            McpToolCallStatus::Completed
        } else {
            McpToolCallStatus::Failed
        };

        let (server, tool, item_id, arguments) =
            match self.running_mcp_tool_calls.remove(&ev.call_id) {
                Some(running) => (
                    running.server,
                    running.tool,
                    running.item_id,
                    running.arguments,
                ),
                None => {
                    warn!(
                        call_id = ev.call_id,
                        "Received McpToolCallEnd without begin; synthesizing new item"
                    );
                    (
                        ev.invocation.server.clone(),
                        ev.invocation.tool.clone(),
                        self.get_next_item_id(),
                        ev.invocation.arguments.clone().unwrap_or(JsonValue::Null),
                    )
                }
            };

        let (result, error) = match &ev.result {
            Ok(value) => {
                let result = McpToolCallItemResult {
                    content: value.content.clone(),
                    structured_content: value.structured_content.clone(),
                };
                (Some(result), None)
            }
            Err(message) => (
                None,
                Some(McpToolCallItemError {
                    message: message.clone(),
                }),
            ),
        };

        let item = ThreadItem {
            id: item_id,
            details: ThreadItemDetails::McpToolCall(McpToolCallItem {
                server,
                tool,
                arguments,
                result,
                error,
                status,
            }),
        };

        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent { item })]
    }

    fn handle_patch_apply_begin(
        &mut self,
        ev: &protocol::PatchApplyBeginEvent,
    ) -> Vec<ThreadEvent> {
        self.running_patch_applies
            .insert(ev.call_id.clone(), ev.clone());

        Vec::new()
    }

    fn map_change_kind(&self, kind: &protocol::FileChange) -> PatchChangeKind {
        match kind {
            protocol::FileChange::Add { .. } => PatchChangeKind::Add,
            protocol::FileChange::Delete { .. } => PatchChangeKind::Delete,
            protocol::FileChange::Update { .. } => PatchChangeKind::Update,
        }
    }

    fn handle_patch_apply_end(&mut self, ev: &protocol::PatchApplyEndEvent) -> Vec<ThreadEvent> {
        if let Some(running_patch_apply) = self.running_patch_applies.remove(&ev.call_id) {
            let status = if ev.success {
                PatchApplyStatus::Completed
            } else {
                PatchApplyStatus::Failed
            };
            let item = ThreadItem {
                id: self.get_next_item_id(),

                details: ThreadItemDetails::FileChange(FileChangeItem {
                    changes: running_patch_apply
                        .changes
                        .iter()
                        .map(|(path, change)| FileUpdateChange {
                            path: path.to_str().unwrap_or("").to_string(),
                            kind: self.map_change_kind(change),
                        })
                        .collect(),
                    status,
                }),
            };

            return vec![ThreadEvent::ItemCompleted(ItemCompletedEvent { item })];
        }

        Vec::new()
    }

    fn handle_exec_command_end(&mut self, ev: &protocol::ExecCommandEndEvent) -> Vec<ThreadEvent> {
        let Some(RunningCommand {
            command,
            item_id,
            aggregated_output,
        }) = self.running_commands.remove(&ev.call_id)
        else {
            warn!(
                call_id = ev.call_id,
                "ExecCommandEnd without matching ExecCommandBegin; skipping item.completed"
            );
            return Vec::new();
        };
        let status = if ev.exit_code == 0 {
            CommandExecutionStatus::Completed
        } else {
            CommandExecutionStatus::Failed
        };
        let aggregated_output = if ev.aggregated_output.is_empty() {
            aggregated_output
        } else {
            ev.aggregated_output.clone()
        };
        let item = ThreadItem {
            id: item_id,

            details: ThreadItemDetails::CommandExecution(CommandExecutionItem {
                command,
                aggregated_output,
                exit_code: Some(ev.exit_code),
                status,
            }),
        };

        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent { item })]
    }

    fn todo_items_from_plan(&self, args: &UpdatePlanArgs) -> Vec<TodoItem> {
        args.plan
            .iter()
            .map(|p| TodoItem {
                text: p.step.clone(),
                completed: matches!(p.status, StepStatus::Completed),
            })
            .collect()
    }

    fn handle_plan_update(&mut self, args: &UpdatePlanArgs) -> Vec<ThreadEvent> {
        let items = self.todo_items_from_plan(args);

        if let Some(running) = &mut self.running_todo_list {
            running.items = items.clone();
            let item = ThreadItem {
                id: running.item_id.clone(),
                details: ThreadItemDetails::TodoList(TodoListItem { items }),
            };
            return vec![ThreadEvent::ItemUpdated(ItemUpdatedEvent { item })];
        }

        let item_id = self.get_next_item_id();
        self.running_todo_list = Some(RunningTodoList {
            item_id: item_id.clone(),
            items: items.clone(),
        });
        let item = ThreadItem {
            id: item_id,
            details: ThreadItemDetails::TodoList(TodoListItem { items }),
        };
        vec![ThreadEvent::ItemStarted(ItemStartedEvent { item })]
    }

    fn handle_task_started(&mut self, _: &protocol::TurnStartedEvent) -> Vec<ThreadEvent> {
        self.last_critical_error = None;
        vec![ThreadEvent::TurnStarted(TurnStartedEvent {})]
    }

    fn handle_task_complete(&mut self) -> Vec<ThreadEvent> {
        let usage = if let Some(u) = &self.last_total_token_usage {
            Usage {
                input_tokens: u.input_tokens,
                cached_input_tokens: u.cached_input_tokens,
                output_tokens: u.output_tokens,
            }
        } else {
            Usage::default()
        };

        let mut items = Vec::new();

        if let Some(running) = self.running_todo_list.take() {
            let item = ThreadItem {
                id: running.item_id,
                details: ThreadItemDetails::TodoList(TodoListItem {
                    items: running.items,
                }),
            };
            items.push(ThreadEvent::ItemCompleted(ItemCompletedEvent { item }));
        }

        if !self.running_commands.is_empty() {
            for (_, running) in self.running_commands.drain() {
                let item = ThreadItem {
                    id: running.item_id,
                    details: ThreadItemDetails::CommandExecution(CommandExecutionItem {
                        command: running.command,
                        aggregated_output: running.aggregated_output,
                        exit_code: None,
                        status: CommandExecutionStatus::Completed,
                    }),
                };
                items.push(ThreadEvent::ItemCompleted(ItemCompletedEvent { item }));
            }
        }

        if let Some(error) = self.last_critical_error.take() {
            items.push(ThreadEvent::TurnFailed(TurnFailedEvent { error }));
        } else {
            items.push(ThreadEvent::TurnCompleted(TurnCompletedEvent { usage }));
        }

        items
    }
}

impl EventProcessor for EventProcessorWithJsonOutput {
    fn print_config_summary(&mut self, _: &Config, _: &str, ev: &protocol::SessionConfiguredEvent) {
        self.process_event(protocol::Event {
            id: "".to_string(),
            msg: protocol::EventMsg::SessionConfigured(ev.clone()),
        });
    }

    #[allow(clippy::print_stdout)]
    fn process_event(&mut self, event: protocol::Event) -> CodexStatus {
        let aggregated = self.collect_thread_events(&event);
        for conv_event in aggregated {
            match serde_json::to_string(&conv_event) {
                Ok(line) => {
                    println!("{line}");
                }
                Err(e) => {
                    error!("Failed to serialize event: {e:?}");
                }
            }
        }

        let protocol::Event { msg, .. } = event;

        if let protocol::EventMsg::TurnComplete(protocol::TurnCompleteEvent {
            last_agent_message,
        }) = msg
        {
            if let Some(output_file) = self.last_message_path.as_deref() {
                handle_last_message(last_agent_message.as_deref(), output_file);
            }
            CodexStatus::InitiateShutdown
        } else {
            CodexStatus::Running
        }
    }
}
</file>

<file path="codex-rs/exec/src/event_processor.rs">
use std::path::Path;

use codex_core::config::Config;
use codex_core::protocol::Event;
use codex_core::protocol::SessionConfiguredEvent;

pub(crate) enum CodexStatus {
    Running,
    InitiateShutdown,
    Shutdown,
}

pub(crate) trait EventProcessor {
    /// Print summary of effective configuration and user prompt.
    fn print_config_summary(
        &mut self,
        config: &Config,
        prompt: &str,
        session_configured: &SessionConfiguredEvent,
    );

    /// Handle a single event emitted by the agent.
    fn process_event(&mut self, event: Event) -> CodexStatus;

    fn print_final_output(&mut self) {}
}

pub(crate) fn handle_last_message(last_agent_message: Option<&str>, output_file: &Path) {
    let message = last_agent_message.unwrap_or_default();
    write_last_message_file(message, Some(output_file));
    if last_agent_message.is_none() {
        eprintln!(
            "Warning: no last agent message; wrote empty content to {}",
            output_file.display()
        );
    }
}

fn write_last_message_file(contents: &str, last_message_path: Option<&Path>) {
    if let Some(path) = last_message_path
        && let Err(e) = std::fs::write(path, contents)
    {
        eprintln!("Failed to write last message file {path:?}: {e}");
    }
}
</file>

<file path="codex-rs/exec/src/exec_events.rs">
use mcp_types::ContentBlock as McpContentBlock;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value as JsonValue;
use ts_rs::TS;

/// Top-level JSONL events emitted by codex exec
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(tag = "type")]
pub enum ThreadEvent {
    /// Emitted when a new thread is started as the first event.
    #[serde(rename = "thread.started")]
    ThreadStarted(ThreadStartedEvent),
    /// Emitted when a turn is started by sending a new prompt to the model.
    /// A turn encompasses all events that happen while agent is processing the prompt.
    #[serde(rename = "turn.started")]
    TurnStarted(TurnStartedEvent),
    /// Emitted when a turn is completed. Typically right after the assistant's response.
    #[serde(rename = "turn.completed")]
    TurnCompleted(TurnCompletedEvent),
    /// Indicates that a turn failed with an error.
    #[serde(rename = "turn.failed")]
    TurnFailed(TurnFailedEvent),
    /// Emitted when a new item is added to the thread. Typically the item will be in an "in progress" state.
    #[serde(rename = "item.started")]
    ItemStarted(ItemStartedEvent),
    /// Emitted when an item is updated.
    #[serde(rename = "item.updated")]
    ItemUpdated(ItemUpdatedEvent),
    /// Signals that an item has reached a terminal state—either success or failure.
    #[serde(rename = "item.completed")]
    ItemCompleted(ItemCompletedEvent),
    /// Represents an unrecoverable error emitted directly by the event stream.
    #[serde(rename = "error")]
    Error(ThreadErrorEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ThreadStartedEvent {
    /// The identified of the new thread. Can be used to resume the thread later.
    pub thread_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS, Default)]

pub struct TurnStartedEvent {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct TurnCompletedEvent {
    pub usage: Usage,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct TurnFailedEvent {
    pub error: ThreadErrorEvent,
}

/// Describes the usage of tokens during a turn.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS, Default)]
pub struct Usage {
    /// The number of input tokens used during the turn.
    pub input_tokens: i64,
    /// The number of cached input tokens used during the turn.
    pub cached_input_tokens: i64,
    /// The number of output tokens used during the turn.
    pub output_tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ItemStartedEvent {
    pub item: ThreadItem,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ItemCompletedEvent {
    pub item: ThreadItem,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ItemUpdatedEvent {
    pub item: ThreadItem,
}

/// Fatal error emitted by the stream.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ThreadErrorEvent {
    pub message: String,
}

/// Canonical representation of a thread item and its domain-specific payload.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ThreadItem {
    pub id: String,
    #[serde(flatten)]
    pub details: ThreadItemDetails,
}

/// Typed payloads for each supported thread item type.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ThreadItemDetails {
    /// Response from the agent.
    /// Either a natural-language response or a JSON string when structured output is requested.
    AgentMessage(AgentMessageItem),
    /// Agent's reasoning summary.
    Reasoning(ReasoningItem),
    /// Tracks a command executed by the agent. The item starts when the command is
    /// spawned, and completes when the process exits with an exit code.
    CommandExecution(CommandExecutionItem),
    /// Represents a set of file changes by the agent. The item is emitted only as a
    /// completed event once the patch succeeds or fails.
    FileChange(FileChangeItem),
    /// Represents a call to an MCP tool. The item starts when the invocation is
    /// dispatched and completes when the MCP server reports success or failure.
    McpToolCall(McpToolCallItem),
    /// Captures a web search request. It starts when the search is kicked off
    /// and completes when results are returned to the agent.
    WebSearch(WebSearchItem),
    /// Tracks the agent's running to-do list. It starts when the plan is first
    /// issued, updates as steps change state, and completes when the turn ends.
    TodoList(TodoListItem),
    /// Describes a non-fatal error surfaced as an item.
    Error(ErrorItem),
}

/// Response from the agent.
/// Either a natural-language response or a JSON string when structured output is requested.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct AgentMessageItem {
    pub text: String,
}

/// Agent's reasoning summary.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ReasoningItem {
    pub text: String,
}

/// The status of a command execution.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default, TS)]
#[serde(rename_all = "snake_case")]
pub enum CommandExecutionStatus {
    #[default]
    InProgress,
    Completed,
    Failed,
    Declined,
}

/// A command executed by the agent.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct CommandExecutionItem {
    pub command: String,
    pub aggregated_output: String,
    pub exit_code: Option<i32>,
    pub status: CommandExecutionStatus,
}

/// A set of file changes by the agent.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct FileUpdateChange {
    pub path: String,
    pub kind: PatchChangeKind,
}

/// The status of a file change.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
pub enum PatchApplyStatus {
    InProgress,
    Completed,
    Failed,
}

/// A set of file changes by the agent.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct FileChangeItem {
    pub changes: Vec<FileUpdateChange>,
    pub status: PatchApplyStatus,
}

/// Indicates the type of the file change.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
pub enum PatchChangeKind {
    Add,
    Delete,
    Update,
}

/// The status of an MCP tool call.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default, TS)]
#[serde(rename_all = "snake_case")]
pub enum McpToolCallStatus {
    #[default]
    InProgress,
    Completed,
    Failed,
}

/// Result payload produced by an MCP tool invocation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct McpToolCallItemResult {
    pub content: Vec<McpContentBlock>,
    pub structured_content: Option<JsonValue>,
}

/// Error details reported by a failed MCP tool invocation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct McpToolCallItemError {
    pub message: String,
}

/// A call to an MCP tool.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct McpToolCallItem {
    pub server: String,
    pub tool: String,
    #[serde(default)]
    pub arguments: JsonValue,
    pub result: Option<McpToolCallItemResult>,
    pub error: Option<McpToolCallItemError>,
    pub status: McpToolCallStatus,
}

/// A web search request.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct WebSearchItem {
    pub query: String,
}

/// An error notification.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct ErrorItem {
    pub message: String,
}

/// An item in agent's to-do list.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct TodoItem {
    pub text: String,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
pub struct TodoListItem {
    pub items: Vec<TodoItem>,
}
</file>

<file path="codex-rs/exec/src/lib.rs">
// - In the default output mode, it is paramount that the only thing written to
//   stdout is the final message (if any).
// - In --json mode, stdout must be valid JSONL, one event per line.
// For both modes, any other output must be written to stderr.
#![deny(clippy::print_stdout)]

mod cli;
mod event_processor;
mod event_processor_with_human_output;
pub mod event_processor_with_jsonl_output;
pub mod exec_events;

pub use cli::Cli;
pub use cli::Command;
pub use cli::ReviewArgs;
use codex_common::oss::ensure_oss_provider_ready;
use codex_common::oss::get_default_model_for_oss_provider;
use codex_common::oss::ollama_chat_deprecation_notice;
use codex_core::AuthManager;
use codex_core::LMSTUDIO_OSS_PROVIDER_ID;
use codex_core::NewThread;
use codex_core::OLLAMA_CHAT_PROVIDER_ID;
use codex_core::OLLAMA_OSS_PROVIDER_ID;
use codex_core::ThreadManager;
use codex_core::auth::enforce_login_restrictions;
use codex_core::config::Config;
use codex_core::config::ConfigOverrides;
use codex_core::config::find_codex_home;
use codex_core::config::load_config_as_toml_with_cli_overrides;
use codex_core::config::resolve_oss_provider;
use codex_core::git_info::get_git_repo_root;
use codex_core::models_manager::manager::RefreshStrategy;
use codex_core::protocol::AskForApproval;
use codex_core::protocol::Event;
use codex_core::protocol::EventMsg;
use codex_core::protocol::Op;
use codex_core::protocol::ReviewRequest;
use codex_core::protocol::ReviewTarget;
use codex_core::protocol::SessionSource;
use codex_protocol::approvals::ElicitationAction;
use codex_protocol::config_types::SandboxMode;
use codex_protocol::user_input::UserInput;
use codex_utils_absolute_path::AbsolutePathBuf;
use event_processor_with_human_output::EventProcessorWithHumanOutput;
use event_processor_with_jsonl_output::EventProcessorWithJsonOutput;
use serde_json::Value;
use std::io::IsTerminal;
use std::io::Read;
use std::path::PathBuf;
use supports_color::Stream;
use tracing::debug;
use tracing::error;
use tracing::info;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::prelude::*;

use crate::cli::Command as ExecCommand;
use crate::event_processor::CodexStatus;
use crate::event_processor::EventProcessor;
use codex_core::default_client::set_default_originator;
use codex_core::find_thread_path_by_id_str;

enum InitialOperation {
    UserTurn {
        items: Vec<UserInput>,
        output_schema: Option<Value>,
    },
    Review {
        review_request: ReviewRequest,
    },
}

pub async fn run_main(cli: Cli, codex_linux_sandbox_exe: Option<PathBuf>) -> anyhow::Result<()> {
    if let Err(err) = set_default_originator("codex_exec".to_string()) {
        tracing::warn!(?err, "Failed to set codex exec originator override {err:?}");
    }

    let Cli {
        command,
        images,
        model: model_cli_arg,
        oss,
        oss_provider,
        config_profile,
        full_auto,
        dangerously_bypass_approvals_and_sandbox,
        cwd,
        skip_git_repo_check,
        add_dir,
        color,
        last_message_file,
        json: json_mode,
        sandbox_mode: sandbox_mode_cli_arg,
        prompt,
        output_schema: output_schema_path,
        config_overrides,
    } = cli;

    let (stdout_with_ansi, stderr_with_ansi) = match color {
        cli::Color::Always => (true, true),
        cli::Color::Never => (false, false),
        cli::Color::Auto => (
            supports_color::on_cached(Stream::Stdout).is_some(),
            supports_color::on_cached(Stream::Stderr).is_some(),
        ),
    };

    // Build fmt layer (existing logging) to compose with OTEL layer.
    let default_level = "error";

    // Build env_filter separately and attach via with_filter.
    let env_filter = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(default_level))
        .unwrap_or_else(|_| EnvFilter::new(default_level));

    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_ansi(stderr_with_ansi)
        .with_writer(std::io::stderr)
        .with_filter(env_filter);

    let sandbox_mode = if full_auto {
        Some(SandboxMode::WorkspaceWrite)
    } else if dangerously_bypass_approvals_and_sandbox {
        Some(SandboxMode::DangerFullAccess)
    } else {
        sandbox_mode_cli_arg.map(Into::<SandboxMode>::into)
    };

    // Parse `-c` overrides from the CLI.
    let cli_kv_overrides = match config_overrides.parse_overrides() {
        Ok(v) => v,
        #[allow(clippy::print_stderr)]
        Err(e) => {
            eprintln!("Error parsing -c overrides: {e}");
            std::process::exit(1);
        }
    };

    let resolved_cwd = cwd.clone();
    let config_cwd = match resolved_cwd.as_deref() {
        Some(path) => AbsolutePathBuf::from_absolute_path(path.canonicalize()?)?,
        None => AbsolutePathBuf::current_dir()?,
    };

    // we load config.toml here to determine project state.
    #[allow(clippy::print_stderr)]
    let config_toml = {
        let codex_home = match find_codex_home() {
            Ok(codex_home) => codex_home,
            Err(err) => {
                eprintln!("Error finding codex home: {err}");
                std::process::exit(1);
            }
        };

        match load_config_as_toml_with_cli_overrides(
            &codex_home,
            &config_cwd,
            cli_kv_overrides.clone(),
        )
        .await
        {
            Ok(config_toml) => config_toml,
            Err(err) => {
                eprintln!("Error loading config.toml: {err}");
                std::process::exit(1);
            }
        }
    };

    let model_provider = if oss {
        let resolved = resolve_oss_provider(
            oss_provider.as_deref(),
            &config_toml,
            config_profile.clone(),
        );

        if let Some(provider) = resolved {
            Some(provider)
        } else {
            return Err(anyhow::anyhow!(
                "No default OSS provider configured. Use --local-provider=provider or set oss_provider to one of: {LMSTUDIO_OSS_PROVIDER_ID}, {OLLAMA_OSS_PROVIDER_ID}, {OLLAMA_CHAT_PROVIDER_ID} in config.toml"
            ));
        }
    } else {
        None // No OSS mode enabled
    };

    // When using `--oss`, let the bootstrapper pick the model based on selected provider
    let model = if let Some(model) = model_cli_arg {
        Some(model)
    } else if oss {
        model_provider
            .as_ref()
            .and_then(|provider_id| get_default_model_for_oss_provider(provider_id))
            .map(std::borrow::ToOwned::to_owned)
    } else {
        None // No model specified, will use the default.
    };

    // Load configuration and determine approval policy
    let overrides = ConfigOverrides {
        model,
        review_model: None,
        config_profile,
        // Default to never ask for approvals in headless mode. Feature flags can override.
        approval_policy: Some(AskForApproval::Never),
        sandbox_mode,
        cwd: resolved_cwd,
        model_provider: model_provider.clone(),
        codex_linux_sandbox_exe,
        base_instructions: None,
        developer_instructions: None,
        compact_prompt: None,
        include_apply_patch_tool: None,
        show_raw_agent_reasoning: oss.then_some(true),
        tools_web_search_request: None,
        additional_writable_roots: add_dir,
    };

    let config =
        Config::load_with_cli_overrides_and_harness_overrides(cli_kv_overrides, overrides).await?;

    if let Err(err) = enforce_login_restrictions(&config) {
        eprintln!("{err}");
        std::process::exit(1);
    }

    let ollama_chat_support_notice = match ollama_chat_deprecation_notice(&config).await {
        Ok(notice) => notice,
        Err(err) => {
            tracing::warn!(?err, "Failed to detect Ollama wire API");
            None
        }
    };

    let otel = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        codex_core::otel_init::build_provider(&config, env!("CARGO_PKG_VERSION"), None, false)
    })) {
        Ok(Ok(otel)) => otel,
        Ok(Err(e)) => {
            eprintln!("Could not create otel exporter: {e}");
            None
        }
        Err(_) => {
            eprintln!("Could not create otel exporter: panicked during initialization");
            None
        }
    };

    let otel_logger_layer = otel.as_ref().and_then(|o| o.logger_layer());

    let otel_tracing_layer = otel.as_ref().and_then(|o| o.tracing_layer());

    let _ = tracing_subscriber::registry()
        .with(fmt_layer)
        .with(otel_tracing_layer)
        .with(otel_logger_layer)
        .try_init();

    let mut event_processor: Box<dyn EventProcessor> = match json_mode {
        true => Box::new(EventProcessorWithJsonOutput::new(last_message_file.clone())),
        _ => Box::new(EventProcessorWithHumanOutput::create_with_ansi(
            stdout_with_ansi,
            &config,
            last_message_file.clone(),
        )),
    };
    if let Some(notice) = ollama_chat_support_notice {
        event_processor.process_event(Event {
            id: String::new(),
            msg: EventMsg::DeprecationNotice(notice),
        });
    }

    if oss {
        // We're in the oss section, so provider_id should be Some
        // Let's handle None case gracefully though just in case
        let provider_id = match model_provider.as_ref() {
            Some(id) => id,
            None => {
                error!("OSS provider unexpectedly not set when oss flag is used");
                return Err(anyhow::anyhow!(
                    "OSS provider not set but oss flag was used"
                ));
            }
        };
        ensure_oss_provider_ready(provider_id, &config)
            .await
            .map_err(|e| anyhow::anyhow!("OSS setup failed: {e}"))?;
    }

    let default_cwd = config.cwd.to_path_buf();
    let default_approval_policy = config.approval_policy.value();
    let default_sandbox_policy = config.sandbox_policy.get();
    let default_effort = config.model_reasoning_effort;
    let default_summary = config.model_reasoning_summary;

    if !skip_git_repo_check && get_git_repo_root(&default_cwd).is_none() {
        eprintln!("Not inside a trusted directory and --skip-git-repo-check was not specified.");
        std::process::exit(1);
    }

    let auth_manager = AuthManager::shared(
        config.codex_home.clone(),
        true,
        config.cli_auth_credentials_store_mode,
    );
    let thread_manager = ThreadManager::new(
        config.codex_home.clone(),
        auth_manager.clone(),
        SessionSource::Exec,
    );
    let default_model = thread_manager
        .get_models_manager()
        .get_default_model(&config.model, &config, RefreshStrategy::OnlineIfUncached)
        .await;

    // Handle resume subcommand by resolving a rollout path and using explicit resume API.
    let NewThread {
        thread_id: _,
        thread,
        session_configured,
    } = if let Some(ExecCommand::Resume(args)) = command.as_ref() {
        let resume_path = resolve_resume_path(&config, args).await?;

        if let Some(path) = resume_path {
            thread_manager
                .resume_thread_from_rollout(config.clone(), path, auth_manager.clone())
                .await?
        } else {
            thread_manager.start_thread(config.clone()).await?
        }
    } else {
        thread_manager.start_thread(config.clone()).await?
    };
    let (initial_operation, prompt_summary) = match (command, prompt, images) {
        (Some(ExecCommand::Review(review_cli)), _, _) => {
            let review_request = build_review_request(review_cli)?;
            let summary = codex_core::review_prompts::user_facing_hint(&review_request.target);
            (InitialOperation::Review { review_request }, summary)
        }
        (Some(ExecCommand::Resume(args)), root_prompt, imgs) => {
            let prompt_arg = args
                .prompt
                .clone()
                .or_else(|| {
                    if args.last {
                        args.session_id.clone()
                    } else {
                        None
                    }
                })
                .or(root_prompt);
            let prompt_text = resolve_prompt(prompt_arg);
            let mut items: Vec<UserInput> = imgs
                .into_iter()
                .chain(args.images.into_iter())
                .map(|path| UserInput::LocalImage { path })
                .collect();
            items.push(UserInput::Text {
                text: prompt_text.clone(),
                text_elements: Vec::new(),
            });
            let output_schema = load_output_schema(output_schema_path.clone());
            (
                InitialOperation::UserTurn {
                    items,
                    output_schema,
                },
                prompt_text,
            )
        }
        (None, root_prompt, imgs) => {
            let prompt_text = resolve_prompt(root_prompt);
            let mut items: Vec<UserInput> = imgs
                .into_iter()
                .map(|path| UserInput::LocalImage { path })
                .collect();
            items.push(UserInput::Text {
                text: prompt_text.clone(),
                text_elements: Vec::new(),
            });
            let output_schema = load_output_schema(output_schema_path);
            (
                InitialOperation::UserTurn {
                    items,
                    output_schema,
                },
                prompt_text,
            )
        }
    };

    // Print the effective configuration and initial request so users can see what Codex
    // is using.
    event_processor.print_config_summary(&config, &prompt_summary, &session_configured);

    info!("Codex initialized with event: {session_configured:?}");

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Event>();
    {
        let thread = thread.clone();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = tokio::signal::ctrl_c() => {
                        tracing::debug!("Keyboard interrupt");
                        // Immediately notify Codex to abort any in‑flight task.
                        thread.submit(Op::Interrupt).await.ok();

                        // Exit the inner loop and return to the main input prompt. The codex
                        // will emit a `TurnInterrupted` (Error) event which is drained later.
                        break;
                    }
                    res = thread.next_event() => match res {
                        Ok(event) => {
                            debug!("Received event: {event:?}");

                            let is_shutdown_complete = matches!(event.msg, EventMsg::ShutdownComplete);
                            if let Err(e) = tx.send(event) {
                                error!("Error sending event: {e:?}");
                                break;
                            }
                            if is_shutdown_complete {
                                info!("Received shutdown event, exiting event loop.");
                                break;
                            }
                        },
                        Err(e) => {
                            error!("Error receiving event: {e:?}");
                            break;
                        }
                    }
                }
            }
        });
    }

    match initial_operation {
        InitialOperation::UserTurn {
            items,
            output_schema,
        } => {
            let task_id = thread
                .submit(Op::UserTurn {
                    items,
                    cwd: default_cwd,
                    approval_policy: default_approval_policy,
                    sandbox_policy: default_sandbox_policy.clone(),
                    model: default_model,
                    effort: default_effort,
                    summary: default_summary,
                    final_output_json_schema: output_schema,
                    collaboration_mode: None,
                })
                .await?;
            info!("Sent prompt with event ID: {task_id}");
            task_id
        }
        InitialOperation::Review { review_request } => {
            let task_id = thread.submit(Op::Review { review_request }).await?;
            info!("Sent review request with event ID: {task_id}");
            task_id
        }
    };

    // Run the loop until the task is complete.
    // Track whether a fatal error was reported by the server so we can
    // exit with a non-zero status for automation-friendly signaling.
    let mut error_seen = false;
    while let Some(event) = rx.recv().await {
        if let EventMsg::ElicitationRequest(ev) = &event.msg {
            // Automatically cancel elicitation requests in exec mode.
            thread
                .submit(Op::ResolveElicitation {
                    server_name: ev.server_name.clone(),
                    request_id: ev.id.clone(),
                    decision: ElicitationAction::Cancel,
                })
                .await?;
        }
        if matches!(event.msg, EventMsg::Error(_)) {
            error_seen = true;
        }
        let shutdown: CodexStatus = event_processor.process_event(event);
        match shutdown {
            CodexStatus::Running => continue,
            CodexStatus::InitiateShutdown => {
                thread.submit(Op::Shutdown).await?;
            }
            CodexStatus::Shutdown => {
                break;
            }
        }
    }
    event_processor.print_final_output();
    if error_seen {
        std::process::exit(1);
    }

    Ok(())
}

async fn resolve_resume_path(
    config: &Config,
    args: &crate::cli::ResumeArgs,
) -> anyhow::Result<Option<PathBuf>> {
    if args.last {
        let default_provider_filter = vec![config.model_provider_id.clone()];
        let filter_cwd = if args.all {
            None
        } else {
            Some(config.cwd.as_path())
        };
        match codex_core::RolloutRecorder::find_latest_thread_path(
            &config.codex_home,
            1,
            None,
            codex_core::ThreadSortKey::UpdatedAt,
            &[],
            Some(default_provider_filter.as_slice()),
            &config.model_provider_id,
            filter_cwd,
        )
        .await
        {
            Ok(path) => Ok(path),
            Err(e) => {
                error!("Error listing threads: {e}");
                Ok(None)
            }
        }
    } else if let Some(id_str) = args.session_id.as_deref() {
        let path = find_thread_path_by_id_str(&config.codex_home, id_str).await?;
        Ok(path)
    } else {
        Ok(None)
    }
}

fn load_output_schema(path: Option<PathBuf>) -> Option<Value> {
    let path = path?;

    let schema_str = match std::fs::read_to_string(&path) {
        Ok(contents) => contents,
        Err(err) => {
            eprintln!(
                "Failed to read output schema file {}: {err}",
                path.display()
            );
            std::process::exit(1);
        }
    };

    match serde_json::from_str::<Value>(&schema_str) {
        Ok(value) => Some(value),
        Err(err) => {
            eprintln!(
                "Output schema file {} is not valid JSON: {err}",
                path.display()
            );
            std::process::exit(1);
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum PromptDecodeError {
    InvalidUtf8 { valid_up_to: usize },
    InvalidUtf16 { encoding: &'static str },
    UnsupportedBom { encoding: &'static str },
}

impl std::fmt::Display for PromptDecodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PromptDecodeError::InvalidUtf8 { valid_up_to } => write!(
                f,
                "input is not valid UTF-8 (invalid byte at offset {valid_up_to}). Convert it to UTF-8 and retry (e.g., `iconv -f <ENC> -t UTF-8 prompt.txt`)."
            ),
            PromptDecodeError::InvalidUtf16 { encoding } => write!(
                f,
                "input looked like {encoding} but could not be decoded. Convert it to UTF-8 and retry."
            ),
            PromptDecodeError::UnsupportedBom { encoding } => write!(
                f,
                "input appears to be {encoding}. Convert it to UTF-8 and retry."
            ),
        }
    }
}

fn decode_prompt_bytes(input: &[u8]) -> Result<String, PromptDecodeError> {
    let input = input.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(input);

    if input.starts_with(&[0xFF, 0xFE, 0x00, 0x00]) {
        return Err(PromptDecodeError::UnsupportedBom {
            encoding: "UTF-32LE",
        });
    }

    if input.starts_with(&[0x00, 0x00, 0xFE, 0xFF]) {
        return Err(PromptDecodeError::UnsupportedBom {
            encoding: "UTF-32BE",
        });
    }

    if let Some(rest) = input.strip_prefix(&[0xFF, 0xFE]) {
        return decode_utf16(rest, "UTF-16LE", u16::from_le_bytes);
    }

    if let Some(rest) = input.strip_prefix(&[0xFE, 0xFF]) {
        return decode_utf16(rest, "UTF-16BE", u16::from_be_bytes);
    }

    std::str::from_utf8(input)
        .map(str::to_string)
        .map_err(|e| PromptDecodeError::InvalidUtf8 {
            valid_up_to: e.valid_up_to(),
        })
}

fn decode_utf16(
    input: &[u8],
    encoding: &'static str,
    decode_unit: fn([u8; 2]) -> u16,
) -> Result<String, PromptDecodeError> {
    if !input.len().is_multiple_of(2) {
        return Err(PromptDecodeError::InvalidUtf16 { encoding });
    }

    let units: Vec<u16> = input
        .chunks_exact(2)
        .map(|chunk| decode_unit([chunk[0], chunk[1]]))
        .collect();

    String::from_utf16(&units).map_err(|_| PromptDecodeError::InvalidUtf16 { encoding })
}

fn resolve_prompt(prompt_arg: Option<String>) -> String {
    match prompt_arg {
        Some(p) if p != "-" => p,
        maybe_dash => {
            let force_stdin = matches!(maybe_dash.as_deref(), Some("-"));

            if std::io::stdin().is_terminal() && !force_stdin {
                eprintln!(
                    "No prompt provided. Either specify one as an argument or pipe the prompt into stdin."
                );
                std::process::exit(1);
            }

            if !force_stdin {
                eprintln!("Reading prompt from stdin...");
            }

            let mut bytes = Vec::new();
            if let Err(e) = std::io::stdin().read_to_end(&mut bytes) {
                eprintln!("Failed to read prompt from stdin: {e}");
                std::process::exit(1);
            }

            let buffer = match decode_prompt_bytes(&bytes) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("Failed to read prompt from stdin: {e}");
                    std::process::exit(1);
                }
            };

            if buffer.trim().is_empty() {
                eprintln!("No prompt provided via stdin.");
                std::process::exit(1);
            }
            buffer
        }
    }
}

fn build_review_request(args: ReviewArgs) -> anyhow::Result<ReviewRequest> {
    let target = if args.uncommitted {
        ReviewTarget::UncommittedChanges
    } else if let Some(branch) = args.base {
        ReviewTarget::BaseBranch { branch }
    } else if let Some(sha) = args.commit {
        ReviewTarget::Commit {
            sha,
            title: args.commit_title,
        }
    } else if let Some(prompt_arg) = args.prompt {
        let prompt = resolve_prompt(Some(prompt_arg)).trim().to_string();
        if prompt.is_empty() {
            anyhow::bail!("Review prompt cannot be empty");
        }
        ReviewTarget::Custom {
            instructions: prompt,
        }
    } else {
        anyhow::bail!(
            "Specify --uncommitted, --base, --commit, or provide custom review instructions"
        );
    };

    Ok(ReviewRequest {
        target,
        user_facing_hint: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn builds_uncommitted_review_request() {
        let request = build_review_request(ReviewArgs {
            uncommitted: true,
            base: None,
            commit: None,
            commit_title: None,
            prompt: None,
        })
        .expect("builds uncommitted review request");

        let expected = ReviewRequest {
            target: ReviewTarget::UncommittedChanges,
            user_facing_hint: None,
        };

        assert_eq!(request, expected);
    }

    #[test]
    fn builds_commit_review_request_with_title() {
        let request = build_review_request(ReviewArgs {
            uncommitted: false,
            base: None,
            commit: Some("123456789".to_string()),
            commit_title: Some("Add review command".to_string()),
            prompt: None,
        })
        .expect("builds commit review request");

        let expected = ReviewRequest {
            target: ReviewTarget::Commit {
                sha: "123456789".to_string(),
                title: Some("Add review command".to_string()),
            },
            user_facing_hint: None,
        };

        assert_eq!(request, expected);
    }

    #[test]
    fn builds_custom_review_request_trims_prompt() {
        let request = build_review_request(ReviewArgs {
            uncommitted: false,
            base: None,
            commit: None,
            commit_title: None,
            prompt: Some("  custom review instructions  ".to_string()),
        })
        .expect("builds custom review request");

        let expected = ReviewRequest {
            target: ReviewTarget::Custom {
                instructions: "custom review instructions".to_string(),
            },
            user_facing_hint: None,
        };

        assert_eq!(request, expected);
    }

    #[test]
    fn decode_prompt_bytes_strips_utf8_bom() {
        let input = [0xEF, 0xBB, 0xBF, b'h', b'i', b'\n'];

        let out = decode_prompt_bytes(&input).expect("decode utf-8 with BOM");

        assert_eq!(out, "hi\n");
    }

    #[test]
    fn decode_prompt_bytes_decodes_utf16le_bom() {
        // UTF-16LE BOM + "hi\n"
        let input = [0xFF, 0xFE, b'h', 0x00, b'i', 0x00, b'\n', 0x00];

        let out = decode_prompt_bytes(&input).expect("decode utf-16le with BOM");

        assert_eq!(out, "hi\n");
    }

    #[test]
    fn decode_prompt_bytes_decodes_utf16be_bom() {
        // UTF-16BE BOM + "hi\n"
        let input = [0xFE, 0xFF, 0x00, b'h', 0x00, b'i', 0x00, b'\n'];

        let out = decode_prompt_bytes(&input).expect("decode utf-16be with BOM");

        assert_eq!(out, "hi\n");
    }

    #[test]
    fn decode_prompt_bytes_rejects_utf32le_bom() {
        // UTF-32LE BOM + "hi\n"
        let input = [
            0xFF, 0xFE, 0x00, 0x00, b'h', 0x00, 0x00, 0x00, b'i', 0x00, 0x00, 0x00, b'\n', 0x00,
            0x00, 0x00,
        ];

        let err = decode_prompt_bytes(&input).expect_err("utf-32le should be rejected");

        assert_eq!(
            err,
            PromptDecodeError::UnsupportedBom {
                encoding: "UTF-32LE"
            }
        );
    }

    #[test]
    fn decode_prompt_bytes_rejects_utf32be_bom() {
        // UTF-32BE BOM + "hi\n"
        let input = [
            0x00, 0x00, 0xFE, 0xFF, 0x00, 0x00, 0x00, b'h', 0x00, 0x00, 0x00, b'i', 0x00, 0x00,
            0x00, b'\n',
        ];

        let err = decode_prompt_bytes(&input).expect_err("utf-32be should be rejected");

        assert_eq!(
            err,
            PromptDecodeError::UnsupportedBom {
                encoding: "UTF-32BE"
            }
        );
    }

    #[test]
    fn decode_prompt_bytes_rejects_invalid_utf8() {
        // Invalid UTF-8 sequence: 0xC3 0x28
        let input = [0xC3, 0x28];

        let err = decode_prompt_bytes(&input).expect_err("invalid utf-8 should fail");

        assert_eq!(err, PromptDecodeError::InvalidUtf8 { valid_up_to: 0 });
    }
}
</file>

<file path="codex-rs/exec/src/main.rs">
//! Entry-point for the `codex-exec` binary.
//!
//! When this CLI is invoked normally, it parses the standard `codex-exec` CLI
//! options and launches the non-interactive Codex agent. However, if it is
//! invoked with arg0 as `codex-linux-sandbox`, we instead treat the invocation
//! as a request to run the logic for the standalone `codex-linux-sandbox`
//! executable (i.e., parse any -s args and then run a *sandboxed* command under
//! Landlock + seccomp.
//!
//! This allows us to ship a completely separate set of functionality as part
//! of the `codex-exec` binary.
use clap::Parser;
use codex_arg0::arg0_dispatch_or_else;
use codex_common::CliConfigOverrides;
use codex_exec::Cli;
use codex_exec::run_main;

#[derive(Parser, Debug)]
struct TopCli {
    #[clap(flatten)]
    config_overrides: CliConfigOverrides,

    #[clap(flatten)]
    inner: Cli,
}

fn main() -> anyhow::Result<()> {
    arg0_dispatch_or_else(|codex_linux_sandbox_exe| async move {
        let top_cli = TopCli::parse();
        // Merge root-level overrides into inner CLI struct so downstream logic remains unchanged.
        let mut inner = top_cli.inner;
        inner
            .config_overrides
            .raw_overrides
            .splice(0..0, top_cli.config_overrides.raw_overrides);

        run_main(inner, codex_linux_sandbox_exe).await?;
        Ok(())
    })
}
</file>

<file path="codex-rs/exec/tests/all.rs">
// Single integration test binary that aggregates all test modules.
// The submodules live in `tests/suite/`.
mod suite;

mod event_processor_with_json_output;
</file>

<file path="codex-rs/exec/tests/event_processor_with_json_output.rs">
use codex_core::protocol::AgentMessageEvent;
use codex_core::protocol::AgentReasoningEvent;
use codex_core::protocol::AskForApproval;
use codex_core::protocol::ErrorEvent;
use codex_core::protocol::Event;
use codex_core::protocol::EventMsg;
use codex_core::protocol::ExecCommandBeginEvent;
use codex_core::protocol::ExecCommandEndEvent;
use codex_core::protocol::ExecCommandSource;
use codex_core::protocol::FileChange;
use codex_core::protocol::McpInvocation;
use codex_core::protocol::McpToolCallBeginEvent;
use codex_core::protocol::McpToolCallEndEvent;
use codex_core::protocol::PatchApplyBeginEvent;
use codex_core::protocol::PatchApplyEndEvent;
use codex_core::protocol::SandboxPolicy;
use codex_core::protocol::SessionConfiguredEvent;
use codex_core::protocol::WarningEvent;
use codex_core::protocol::WebSearchEndEvent;
use codex_exec::event_processor_with_jsonl_output::EventProcessorWithJsonOutput;
use codex_exec::exec_events::AgentMessageItem;
use codex_exec::exec_events::CommandExecutionItem;
use codex_exec::exec_events::CommandExecutionStatus;
use codex_exec::exec_events::ErrorItem;
use codex_exec::exec_events::ItemCompletedEvent;
use codex_exec::exec_events::ItemStartedEvent;
use codex_exec::exec_events::ItemUpdatedEvent;
use codex_exec::exec_events::McpToolCallItem;
use codex_exec::exec_events::McpToolCallItemError;
use codex_exec::exec_events::McpToolCallItemResult;
use codex_exec::exec_events::McpToolCallStatus;
use codex_exec::exec_events::PatchApplyStatus;
use codex_exec::exec_events::PatchChangeKind;
use codex_exec::exec_events::ReasoningItem;
use codex_exec::exec_events::ThreadErrorEvent;
use codex_exec::exec_events::ThreadEvent;
use codex_exec::exec_events::ThreadItem;
use codex_exec::exec_events::ThreadItemDetails;
use codex_exec::exec_events::ThreadStartedEvent;
use codex_exec::exec_events::TodoItem as ExecTodoItem;
use codex_exec::exec_events::TodoListItem as ExecTodoListItem;
use codex_exec::exec_events::TurnCompletedEvent;
use codex_exec::exec_events::TurnFailedEvent;
use codex_exec::exec_events::TurnStartedEvent;
use codex_exec::exec_events::Usage;
use codex_exec::exec_events::WebSearchItem;
use codex_protocol::plan_tool::PlanItemArg;
use codex_protocol::plan_tool::StepStatus;
use codex_protocol::plan_tool::UpdatePlanArgs;
use codex_protocol::protocol::CodexErrorInfo;
use codex_protocol::protocol::ExecCommandOutputDeltaEvent;
use codex_protocol::protocol::ExecOutputStream;
use mcp_types::CallToolResult;
use mcp_types::ContentBlock;
use mcp_types::TextContent;
use pretty_assertions::assert_eq;
use serde_json::json;
use std::path::PathBuf;
use std::time::Duration;

fn event(id: &str, msg: EventMsg) -> Event {
    Event {
        id: id.to_string(),
        msg,
    }
}

#[test]
fn session_configured_produces_thread_started_event() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let session_id =
        codex_protocol::ThreadId::from_string("67e55044-10b1-426f-9247-bb680e5fe0c8").unwrap();
    let rollout_path = PathBuf::from("/tmp/rollout.json");
    let ev = event(
        "e1",
        EventMsg::SessionConfigured(SessionConfiguredEvent {
            session_id,
            forked_from_id: None,
            model: "codex-mini-latest".to_string(),
            model_provider_id: "test-provider".to_string(),
            approval_policy: AskForApproval::Never,
            sandbox_policy: SandboxPolicy::ReadOnly,
            cwd: PathBuf::from("/home/user/project"),
            reasoning_effort: None,
            history_log_id: 0,
            history_entry_count: 0,
            initial_messages: None,
            rollout_path,
        }),
    );
    let out = ep.collect_thread_events(&ev);
    assert_eq!(
        out,
        vec![ThreadEvent::ThreadStarted(ThreadStartedEvent {
            thread_id: "67e55044-10b1-426f-9247-bb680e5fe0c8".to_string(),
        })]
    );
}

#[test]
fn task_started_produces_turn_started_event() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let out = ep.collect_thread_events(&event(
        "t1",
        EventMsg::TurnStarted(codex_core::protocol::TurnStartedEvent {
            model_context_window: Some(32_000),
        }),
    ));

    assert_eq!(out, vec![ThreadEvent::TurnStarted(TurnStartedEvent {})]);
}

#[test]
fn web_search_end_emits_item_completed() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let query = "rust async await".to_string();
    let out = ep.collect_thread_events(&event(
        "w1",
        EventMsg::WebSearchEnd(WebSearchEndEvent {
            call_id: "call-123".to_string(),
            query: query.clone(),
        }),
    ));

    assert_eq!(
        out,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::WebSearch(WebSearchItem { query }),
            },
        })]
    );
}

#[test]
fn plan_update_emits_todo_list_started_updated_and_completed() {
    let mut ep = EventProcessorWithJsonOutput::new(None);

    // First plan update => item.started (todo_list)
    let first = event(
        "p1",
        EventMsg::PlanUpdate(UpdatePlanArgs {
            explanation: None,
            plan: vec![
                PlanItemArg {
                    step: "step one".to_string(),
                    status: StepStatus::Pending,
                },
                PlanItemArg {
                    step: "step two".to_string(),
                    status: StepStatus::InProgress,
                },
            ],
        }),
    );
    let out_first = ep.collect_thread_events(&first);
    assert_eq!(
        out_first,
        vec![ThreadEvent::ItemStarted(ItemStartedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::TodoList(ExecTodoListItem {
                    items: vec![
                        ExecTodoItem {
                            text: "step one".to_string(),
                            completed: false
                        },
                        ExecTodoItem {
                            text: "step two".to_string(),
                            completed: false
                        },
                    ],
                }),
            },
        })]
    );

    // Second plan update in same turn => item.updated (same id)
    let second = event(
        "p2",
        EventMsg::PlanUpdate(UpdatePlanArgs {
            explanation: None,
            plan: vec![
                PlanItemArg {
                    step: "step one".to_string(),
                    status: StepStatus::Completed,
                },
                PlanItemArg {
                    step: "step two".to_string(),
                    status: StepStatus::InProgress,
                },
            ],
        }),
    );
    let out_second = ep.collect_thread_events(&second);
    assert_eq!(
        out_second,
        vec![ThreadEvent::ItemUpdated(ItemUpdatedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::TodoList(ExecTodoListItem {
                    items: vec![
                        ExecTodoItem {
                            text: "step one".to_string(),
                            completed: true
                        },
                        ExecTodoItem {
                            text: "step two".to_string(),
                            completed: false
                        },
                    ],
                }),
            },
        })]
    );

    // Task completes => item.completed (same id, latest state)
    let complete = event(
        "p3",
        EventMsg::TurnComplete(codex_core::protocol::TurnCompleteEvent {
            last_agent_message: None,
        }),
    );
    let out_complete = ep.collect_thread_events(&complete);
    assert_eq!(
        out_complete,
        vec![
            ThreadEvent::ItemCompleted(ItemCompletedEvent {
                item: ThreadItem {
                    id: "item_0".to_string(),
                    details: ThreadItemDetails::TodoList(ExecTodoListItem {
                        items: vec![
                            ExecTodoItem {
                                text: "step one".to_string(),
                                completed: true
                            },
                            ExecTodoItem {
                                text: "step two".to_string(),
                                completed: false
                            },
                        ],
                    }),
                },
            }),
            ThreadEvent::TurnCompleted(TurnCompletedEvent {
                usage: Usage::default(),
            }),
        ]
    );
}

#[test]
fn mcp_tool_call_begin_and_end_emit_item_events() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let invocation = McpInvocation {
        server: "server_a".to_string(),
        tool: "tool_x".to_string(),
        arguments: Some(json!({ "key": "value" })),
    };

    let begin = event(
        "m1",
        EventMsg::McpToolCallBegin(McpToolCallBeginEvent {
            call_id: "call-1".to_string(),
            invocation: invocation.clone(),
        }),
    );
    let begin_events = ep.collect_thread_events(&begin);
    assert_eq!(
        begin_events,
        vec![ThreadEvent::ItemStarted(ItemStartedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::McpToolCall(McpToolCallItem {
                    server: "server_a".to_string(),
                    tool: "tool_x".to_string(),
                    arguments: json!({ "key": "value" }),
                    result: None,
                    error: None,
                    status: McpToolCallStatus::InProgress,
                }),
            },
        })]
    );

    let end = event(
        "m2",
        EventMsg::McpToolCallEnd(McpToolCallEndEvent {
            call_id: "call-1".to_string(),
            invocation,
            duration: Duration::from_secs(1),
            result: Ok(CallToolResult {
                content: Vec::new(),
                is_error: None,
                structured_content: None,
            }),
        }),
    );
    let end_events = ep.collect_thread_events(&end);
    assert_eq!(
        end_events,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::McpToolCall(McpToolCallItem {
                    server: "server_a".to_string(),
                    tool: "tool_x".to_string(),
                    arguments: json!({ "key": "value" }),
                    result: Some(McpToolCallItemResult {
                        content: Vec::new(),
                        structured_content: None,
                    }),
                    error: None,
                    status: McpToolCallStatus::Completed,
                }),
            },
        })]
    );
}

#[test]
fn mcp_tool_call_failure_sets_failed_status() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let invocation = McpInvocation {
        server: "server_b".to_string(),
        tool: "tool_y".to_string(),
        arguments: Some(json!({ "param": 42 })),
    };

    let begin = event(
        "m3",
        EventMsg::McpToolCallBegin(McpToolCallBeginEvent {
            call_id: "call-2".to_string(),
            invocation: invocation.clone(),
        }),
    );
    ep.collect_thread_events(&begin);

    let end = event(
        "m4",
        EventMsg::McpToolCallEnd(McpToolCallEndEvent {
            call_id: "call-2".to_string(),
            invocation,
            duration: Duration::from_millis(5),
            result: Err("tool exploded".to_string()),
        }),
    );
    let events = ep.collect_thread_events(&end);
    assert_eq!(
        events,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::McpToolCall(McpToolCallItem {
                    server: "server_b".to_string(),
                    tool: "tool_y".to_string(),
                    arguments: json!({ "param": 42 }),
                    result: None,
                    error: Some(McpToolCallItemError {
                        message: "tool exploded".to_string(),
                    }),
                    status: McpToolCallStatus::Failed,
                }),
            },
        })]
    );
}

#[test]
fn mcp_tool_call_defaults_arguments_and_preserves_structured_content() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let invocation = McpInvocation {
        server: "server_c".to_string(),
        tool: "tool_z".to_string(),
        arguments: None,
    };

    let begin = event(
        "m5",
        EventMsg::McpToolCallBegin(McpToolCallBeginEvent {
            call_id: "call-3".to_string(),
            invocation: invocation.clone(),
        }),
    );
    let begin_events = ep.collect_thread_events(&begin);
    assert_eq!(
        begin_events,
        vec![ThreadEvent::ItemStarted(ItemStartedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::McpToolCall(McpToolCallItem {
                    server: "server_c".to_string(),
                    tool: "tool_z".to_string(),
                    arguments: serde_json::Value::Null,
                    result: None,
                    error: None,
                    status: McpToolCallStatus::InProgress,
                }),
            },
        })]
    );

    let end = event(
        "m6",
        EventMsg::McpToolCallEnd(McpToolCallEndEvent {
            call_id: "call-3".to_string(),
            invocation,
            duration: Duration::from_millis(10),
            result: Ok(CallToolResult {
                content: vec![ContentBlock::TextContent(TextContent {
                    annotations: None,
                    text: "done".to_string(),
                    r#type: "text".to_string(),
                })],
                is_error: None,
                structured_content: Some(json!({ "status": "ok" })),
            }),
        }),
    );
    let events = ep.collect_thread_events(&end);
    assert_eq!(
        events,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::McpToolCall(McpToolCallItem {
                    server: "server_c".to_string(),
                    tool: "tool_z".to_string(),
                    arguments: serde_json::Value::Null,
                    result: Some(McpToolCallItemResult {
                        content: vec![ContentBlock::TextContent(TextContent {
                            annotations: None,
                            text: "done".to_string(),
                            r#type: "text".to_string(),
                        })],
                        structured_content: Some(json!({ "status": "ok" })),
                    }),
                    error: None,
                    status: McpToolCallStatus::Completed,
                }),
            },
        })]
    );
}

#[test]
fn plan_update_after_complete_starts_new_todo_list_with_new_id() {
    let mut ep = EventProcessorWithJsonOutput::new(None);

    // First turn: start + complete
    let start = event(
        "t1",
        EventMsg::PlanUpdate(UpdatePlanArgs {
            explanation: None,
            plan: vec![PlanItemArg {
                step: "only".to_string(),
                status: StepStatus::Pending,
            }],
        }),
    );
    let _ = ep.collect_thread_events(&start);
    let complete = event(
        "t2",
        EventMsg::TurnComplete(codex_core::protocol::TurnCompleteEvent {
            last_agent_message: None,
        }),
    );
    let _ = ep.collect_thread_events(&complete);

    // Second turn: a new todo list should have a new id
    let start_again = event(
        "t3",
        EventMsg::PlanUpdate(UpdatePlanArgs {
            explanation: None,
            plan: vec![PlanItemArg {
                step: "again".to_string(),
                status: StepStatus::Pending,
            }],
        }),
    );
    let out = ep.collect_thread_events(&start_again);

    match &out[0] {
        ThreadEvent::ItemStarted(ItemStartedEvent { item }) => {
            assert_eq!(&item.id, "item_1");
        }
        other => panic!("unexpected event: {other:?}"),
    }
}

#[test]
fn agent_reasoning_produces_item_completed_reasoning() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let ev = event(
        "e1",
        EventMsg::AgentReasoning(AgentReasoningEvent {
            text: "thinking...".to_string(),
        }),
    );
    let out = ep.collect_thread_events(&ev);
    assert_eq!(
        out,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::Reasoning(ReasoningItem {
                    text: "thinking...".to_string(),
                }),
            },
        })]
    );
}

#[test]
fn agent_message_produces_item_completed_agent_message() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let ev = event(
        "e1",
        EventMsg::AgentMessage(AgentMessageEvent {
            message: "hello".to_string(),
        }),
    );
    let out = ep.collect_thread_events(&ev);
    assert_eq!(
        out,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::AgentMessage(AgentMessageItem {
                    text: "hello".to_string(),
                }),
            },
        })]
    );
}

#[test]
fn error_event_produces_error() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let out = ep.collect_thread_events(&event(
        "e1",
        EventMsg::Error(codex_core::protocol::ErrorEvent {
            message: "boom".to_string(),
            codex_error_info: Some(CodexErrorInfo::Other),
        }),
    ));
    assert_eq!(
        out,
        vec![ThreadEvent::Error(ThreadErrorEvent {
            message: "boom".to_string(),
        })]
    );
}

#[test]
fn warning_event_produces_error_item() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let out = ep.collect_thread_events(&event(
        "e1",
        EventMsg::Warning(WarningEvent {
            message: "Heads up: Long conversations and multiple compactions can cause the model to be less accurate. Start a new conversation when possible to keep conversations small and targeted.".to_string(),
        }),
    ));
    assert_eq!(
        out,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::Error(ErrorItem {
                    message: "Heads up: Long conversations and multiple compactions can cause the model to be less accurate. Start a new conversation when possible to keep conversations small and targeted.".to_string(),
                }),
            },
        })]
    );
}

#[test]
fn stream_error_event_produces_error() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let out = ep.collect_thread_events(&event(
        "e1",
        EventMsg::StreamError(codex_core::protocol::StreamErrorEvent {
            message: "retrying".to_string(),
            codex_error_info: Some(CodexErrorInfo::Other),
            additional_details: None,
        }),
    ));
    assert_eq!(
        out,
        vec![ThreadEvent::Error(ThreadErrorEvent {
            message: "retrying".to_string(),
        })]
    );
}

#[test]
fn error_followed_by_task_complete_produces_turn_failed() {
    let mut ep = EventProcessorWithJsonOutput::new(None);

    let error_event = event(
        "e1",
        EventMsg::Error(ErrorEvent {
            message: "boom".to_string(),
            codex_error_info: Some(CodexErrorInfo::Other),
        }),
    );
    assert_eq!(
        ep.collect_thread_events(&error_event),
        vec![ThreadEvent::Error(ThreadErrorEvent {
            message: "boom".to_string(),
        })]
    );

    let complete_event = event(
        "e2",
        EventMsg::TurnComplete(codex_core::protocol::TurnCompleteEvent {
            last_agent_message: None,
        }),
    );
    assert_eq!(
        ep.collect_thread_events(&complete_event),
        vec![ThreadEvent::TurnFailed(TurnFailedEvent {
            error: ThreadErrorEvent {
                message: "boom".to_string(),
            },
        })]
    );
}

#[test]
fn exec_command_end_success_produces_completed_command_item() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let command = vec!["bash".to_string(), "-lc".to_string(), "echo hi".to_string()];
    let cwd = std::env::current_dir().unwrap();
    let parsed_cmd = Vec::new();

    // Begin -> no output
    let begin = event(
        "c1",
        EventMsg::ExecCommandBegin(ExecCommandBeginEvent {
            call_id: "1".to_string(),
            process_id: None,
            turn_id: "turn-1".to_string(),
            command: command.clone(),
            cwd: cwd.clone(),
            parsed_cmd: parsed_cmd.clone(),
            source: ExecCommandSource::Agent,
            interaction_input: None,
        }),
    );
    let out_begin = ep.collect_thread_events(&begin);
    assert_eq!(
        out_begin,
        vec![ThreadEvent::ItemStarted(ItemStartedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::CommandExecution(CommandExecutionItem {
                    command: "bash -lc 'echo hi'".to_string(),
                    aggregated_output: String::new(),
                    exit_code: None,
                    status: CommandExecutionStatus::InProgress,
                }),
            },
        })]
    );

    // End (success) -> item.completed (item_0)
    let end_ok = event(
        "c2",
        EventMsg::ExecCommandEnd(ExecCommandEndEvent {
            call_id: "1".to_string(),
            process_id: None,
            turn_id: "turn-1".to_string(),
            command,
            cwd,
            parsed_cmd,
            source: ExecCommandSource::Agent,
            interaction_input: None,
            stdout: String::new(),
            stderr: String::new(),
            aggregated_output: "hi\n".to_string(),
            exit_code: 0,
            duration: Duration::from_millis(5),
            formatted_output: String::new(),
        }),
    );
    let out_ok = ep.collect_thread_events(&end_ok);
    assert_eq!(
        out_ok,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::CommandExecution(CommandExecutionItem {
                    command: "bash -lc 'echo hi'".to_string(),
                    aggregated_output: "hi\n".to_string(),
                    exit_code: Some(0),
                    status: CommandExecutionStatus::Completed,
                }),
            },
        })]
    );
}

#[test]
fn command_execution_output_delta_updates_item_progress() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let command = vec![
        "bash".to_string(),
        "-lc".to_string(),
        "echo delta".to_string(),
    ];
    let cwd = std::env::current_dir().unwrap();
    let parsed_cmd = Vec::new();

    let begin = event(
        "d1",
        EventMsg::ExecCommandBegin(ExecCommandBeginEvent {
            call_id: "delta-1".to_string(),
            process_id: Some("42".to_string()),
            turn_id: "turn-1".to_string(),
            command: command.clone(),
            cwd: cwd.clone(),
            parsed_cmd: parsed_cmd.clone(),
            source: ExecCommandSource::Agent,
            interaction_input: None,
        }),
    );
    let out_begin = ep.collect_thread_events(&begin);
    assert_eq!(
        out_begin,
        vec![ThreadEvent::ItemStarted(ItemStartedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::CommandExecution(CommandExecutionItem {
                    command: "bash -lc 'echo delta'".to_string(),
                    aggregated_output: String::new(),
                    exit_code: None,
                    status: CommandExecutionStatus::InProgress,
                }),
            },
        })]
    );

    let delta = event(
        "d2",
        EventMsg::ExecCommandOutputDelta(ExecCommandOutputDeltaEvent {
            call_id: "delta-1".to_string(),
            stream: ExecOutputStream::Stdout,
            chunk: b"partial output\n".to_vec(),
        }),
    );
    let out_delta = ep.collect_thread_events(&delta);
    assert_eq!(out_delta, Vec::<ThreadEvent>::new());

    let end = event(
        "d3",
        EventMsg::ExecCommandEnd(ExecCommandEndEvent {
            call_id: "delta-1".to_string(),
            process_id: Some("42".to_string()),
            turn_id: "turn-1".to_string(),
            command,
            cwd,
            parsed_cmd,
            source: ExecCommandSource::Agent,
            interaction_input: None,
            stdout: String::new(),
            stderr: String::new(),
            aggregated_output: String::new(),
            exit_code: 0,
            duration: Duration::from_millis(3),
            formatted_output: String::new(),
        }),
    );
    let out_end = ep.collect_thread_events(&end);
    assert_eq!(
        out_end,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::CommandExecution(CommandExecutionItem {
                    command: "bash -lc 'echo delta'".to_string(),
                    aggregated_output: String::new(),
                    exit_code: Some(0),
                    status: CommandExecutionStatus::Completed,
                }),
            },
        })]
    );
}

#[test]
fn exec_command_end_failure_produces_failed_command_item() {
    let mut ep = EventProcessorWithJsonOutput::new(None);
    let command = vec!["sh".to_string(), "-c".to_string(), "exit 1".to_string()];
    let cwd = std::env::current_dir().unwrap();
    let parsed_cmd = Vec::new();

    // Begin -> no output
    let begin = event(
        "c1",
        EventMsg::ExecCommandBegin(ExecCommandBeginEvent {
            call_id: "2".to_string(),
            process_id: None,
            turn_id: "turn-1".to_string(),
            command: command.clone(),
            cwd: cwd.clone(),
            parsed_cmd: parsed_cmd.clone(),
            source: ExecCommandSource::Agent,
            interaction_input: None,
        }),
    );
    assert_eq!(
        ep.collect_thread_events(&begin),
        vec![ThreadEvent::ItemStarted(ItemStartedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::CommandExecution(CommandExecutionItem {
                    command: "sh -c 'exit 1'".to_string(),
                    aggregated_output: String::new(),
                    exit_code: None,
                    status: CommandExecutionStatus::InProgress,
                }),
            },
        })]
    );

    // End (failure) -> item.completed (item_0)
    let end_fail = event(
        "c2",
        EventMsg::ExecCommandEnd(ExecCommandEndEvent {
            call_id: "2".to_string(),
            process_id: None,
            turn_id: "turn-1".to_string(),
            command,
            cwd,
            parsed_cmd,
            source: ExecCommandSource::Agent,
            interaction_input: None,
            stdout: String::new(),
            stderr: String::new(),
            aggregated_output: String::new(),
            exit_code: 1,
            duration: Duration::from_millis(2),
            formatted_output: String::new(),
        }),
    );
    let out_fail = ep.collect_thread_events(&end_fail);
    assert_eq!(
        out_fail,
        vec![ThreadEvent::ItemCompleted(ItemCompletedEvent {
            item: ThreadItem {
                id: "item_0".to_string(),
                details: ThreadItemDetails::CommandExecution(CommandExecutionItem {
                    command: "sh -c 'exit 1'".to_string(),
                    aggregated_output: String::new(),
                    exit_code: Some(1),
                    status: CommandExecutionStatus::Failed,
                }),
            },
        })]
    );
}

#[test]
fn exec_command_end_without_begin_is_ignored() {
    let mut ep = EventProcessorWithJsonOutput::new(None);

    // End event arrives without a prior Begin; should produce no thread events.
    let end_only = event(
        "c1",
        EventMsg::ExecCommandEnd(ExecCommandEndEvent {
            call_id: "no-begin".to_string(),
            process_id: None,
            turn_id: "turn-1".to_string(),
            command: Vec::new(),
            cwd: PathBuf::from("."),
            parsed_cmd: Vec::new(),
            source: ExecCommandSource::Agent,
            interaction_input: None,
            stdout: String::new(),
            stderr: String::new(),
            aggregated_output: String::new(),
            exit_code: 0,
            duration: Duration::from_millis(1),
            formatted_output: String::new(),
        }),
    );
    let out = ep.collect_thread_events(&end_only);
    assert!(out.is_empty());
}

#[test]
fn patch_apply_success_produces_item_completed_patchapply() {
    let mut ep = EventProcessorWithJsonOutput::new(None);

    // Prepare a patch with multiple kinds of changes
    let mut changes = std::collections::HashMap::new();
    changes.insert(
        PathBuf::from("a/added.txt"),
        FileChange::Add {
            content: "+hello".to_string(),
        },
    );
    changes.insert(
        PathBuf::from("b/deleted.txt"),
        FileChange::Delete {
            content: "-goodbye".to_string(),
        },
    );
    changes.insert(
        PathBuf::from("c/modified.txt"),
        FileChange::Update {
            unified_diff: "--- c/modified.txt\n+++ c/modified.txt\n@@\n-old\n+new\n".to_string(),
            move_path: Some(PathBuf::from("c/renamed.txt")),
        },
    );

    // Begin -> no output
    let begin = event(
        "p1",
        EventMsg::PatchApplyBegin(PatchApplyBeginEvent {
            call_id: "call-1".to_string(),
            turn_id: "turn-1".to_string(),
            auto_approved: true,
            changes: changes.clone(),
        }),
    );
    let out_begin = ep.collect_thread_events(&begin);
    assert!(out_begin.is_empty());

    // End (success) -> item.completed (item_0)
    let end = event(
        "p2",
        EventMsg::PatchApplyEnd(PatchApplyEndEvent {
            call_id: "call-1".to_string(),
            turn_id: "turn-1".to_string(),
            stdout: "applied 3 changes".to_string(),
            stderr: String::new(),
            success: true,
            changes: changes.clone(),
        }),
    );
    let out_end = ep.collect_thread_events(&end);
    assert_eq!(out_end.len(), 1);

    // Validate structure without relying on HashMap iteration order
    match &out_end[0] {
        ThreadEvent::ItemCompleted(ItemCompletedEvent { item }) => {
            assert_eq!(&item.id, "item_0");
            match &item.details {
                ThreadItemDetails::FileChange(file_update) => {
                    assert_eq!(file_update.status, PatchApplyStatus::Completed);

                    let mut actual: Vec<(String, PatchChangeKind)> = file_update
                        .changes
                        .iter()
                        .map(|c| (c.path.clone(), c.kind.clone()))
                        .collect();
                    actual.sort_by(|a, b| a.0.cmp(&b.0));

                    let mut expected = vec![
                        ("a/added.txt".to_string(), PatchChangeKind::Add),
                        ("b/deleted.txt".to_string(), PatchChangeKind::Delete),
                        ("c/modified.txt".to_string(), PatchChangeKind::Update),
                    ];
                    expected.sort_by(|a, b| a.0.cmp(&b.0));

                    assert_eq!(actual, expected);
                }
                other => panic!("unexpected details: {other:?}"),
            }
        }
        other => panic!("unexpected event: {other:?}"),
    }
}

#[test]
fn patch_apply_failure_produces_item_completed_patchapply_failed() {
    let mut ep = EventProcessorWithJsonOutput::new(None);

    let mut changes = std::collections::HashMap::new();
    changes.insert(
        PathBuf::from("file.txt"),
        FileChange::Update {
            unified_diff: "--- file.txt\n+++ file.txt\n@@\n-old\n+new\n".to_string(),
            move_path: None,
        },
    );

    // Begin -> no output
    let begin = event(
        "p1",
        EventMsg::PatchApplyBegin(PatchApplyBeginEvent {
            call_id: "call-2".to_string(),
            turn_id: "turn-2".to_string(),
            auto_approved: false,
            changes: changes.clone(),
        }),
    );
    assert!(ep.collect_thread_events(&begin).is_empty());

    // End (failure) -> item.completed (item_0) with Failed status
    let end = event(
        "p2",
        EventMsg::PatchApplyEnd(PatchApplyEndEvent {
            call_id: "call-2".to_string(),
            turn_id: "turn-2".to_string(),
            stdout: String::new(),
            stderr: "failed to apply".to_string(),
            success: false,
            changes: changes.clone(),
        }),
    );
    let out_end = ep.collect_thread_events(&end);
    assert_eq!(out_end.len(), 1);

    match &out_end[0] {
        ThreadEvent::ItemCompleted(ItemCompletedEvent { item }) => {
            assert_eq!(&item.id, "item_0");
            match &item.details {
                ThreadItemDetails::FileChange(file_update) => {
                    assert_eq!(file_update.status, PatchApplyStatus::Failed);
                    assert_eq!(file_update.changes.len(), 1);
                    assert_eq!(file_update.changes[0].path, "file.txt".to_string());
                    assert_eq!(file_update.changes[0].kind, PatchChangeKind::Update);
                }
                other => panic!("unexpected details: {other:?}"),
            }
        }
        other => panic!("unexpected event: {other:?}"),
    }
}

#[test]
fn task_complete_produces_turn_completed_with_usage() {
    let mut ep = EventProcessorWithJsonOutput::new(None);

    // First, feed a TokenCount event with known totals.
    let usage = codex_core::protocol::TokenUsage {
        input_tokens: 1200,
        cached_input_tokens: 200,
        output_tokens: 345,
        reasoning_output_tokens: 0,
        total_tokens: 0,
    };
    let info = codex_core::protocol::TokenUsageInfo {
        total_token_usage: usage.clone(),
        last_token_usage: usage,
        model_context_window: None,
    };
    let token_count_event = event(
        "e1",
        EventMsg::TokenCount(codex_core::protocol::TokenCountEvent {
            info: Some(info),
            rate_limits: None,
        }),
    );
    assert!(ep.collect_thread_events(&token_count_event).is_empty());

    // Then TurnComplete should produce turn.completed with the captured usage.
    let complete_event = event(
        "e2",
        EventMsg::TurnComplete(codex_core::protocol::TurnCompleteEvent {
            last_agent_message: Some("done".to_string()),
        }),
    );
    let out = ep.collect_thread_events(&complete_event);
    assert_eq!(
        out,
        vec![ThreadEvent::TurnCompleted(TurnCompletedEvent {
            usage: Usage {
                input_tokens: 1200,
                cached_input_tokens: 200,
                output_tokens: 345,
            },
        })]
    );
}
</file>

<file path="codex-rs/exec/BUILD.bazel">
load("//:defs.bzl", "codex_rust_crate")

codex_rust_crate(
    name = "exec",
    crate_name = "codex_exec",
    test_tags = ["no-sandbox"],
)
</file>

<file path="codex-rs/exec/Cargo.toml">
[package]
name = "codex-exec"
version.workspace = true
edition.workspace = true
license.workspace = true

[[bin]]
name = "codex-exec"
path = "src/main.rs"

[lib]
name = "codex_exec"
path = "src/lib.rs"

[lints]
workspace = true

[dependencies]
anyhow = { workspace = true }
clap = { workspace = true, features = ["derive"] }
codex-arg0 = { workspace = true }
codex-common = { workspace = true, features = [
    "cli",
    "elapsed",
    "sandbox_summary",
] }
codex-core = { workspace = true }
codex-protocol = { workspace = true }
codex-utils-absolute-path = { workspace = true }
mcp-types = { workspace = true }
owo-colors = { workspace = true }
serde = { workspace = true, features = ["derive"] }
serde_json = { workspace = true }
shlex = { workspace = true }
supports-color = { workspace = true }
tokio = { workspace = true, features = [
    "io-std",
    "macros",
    "process",
    "rt-multi-thread",
    "signal",
] }
tracing = { workspace = true, features = ["log"] }
tracing-subscriber = { workspace = true, features = ["env-filter"] }
ts-rs = { workspace = true, features = [
    "uuid-impl",
    "serde-json-impl",
    "no-serde-warnings",
] }


[dev-dependencies]
assert_cmd = { workspace = true }
codex-utils-cargo-bin = { workspace = true }
core_test_support = { workspace = true }
libc = { workspace = true }
mcp-types = { workspace = true }
predicates = { workspace = true }
pretty_assertions = { workspace = true }
tempfile = { workspace = true }
uuid = { workspace = true }
walkdir = { workspace = true }
wiremock = { workspace = true }
</file>

</files>
