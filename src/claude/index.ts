import { ClaudeExecutor } from "./executor.js";
import type { ClaudeConfig, ClaudeExecuteOptions } from "./types.js";
import { SessionHandler, type ChatSession } from "../session/index.js";
import { defaultSystemPrompt } from "./system_prompt.js";
import { SessionBusyError } from "./errors.js";
export * from "./types.js";
export * from "./executor.js";
export * from "./errors.js";

export type SessionState = "idle" | "processing" | "awaiting_approval";

export interface ClaudeCodeOptions {
  config: ClaudeConfig;
  sessionId?: string; // Initial session ID (for restoring from persistence)
  systemPrompt?: string;
}

/**
 * ClaudeCode class manages Claude CLI interactions and session state
 *
 * This class serves as the main interface layer between chat providers and Claude CLI.
 */
export class ClaudeCode {
  private executor: ClaudeExecutor;
  private sessionHandler: SessionHandler;
  private sessionId: string | null = null;
  private config: ClaudeConfig;
  private systemPrompt: string;
  private state: SessionState = "idle";

  constructor(options: ClaudeCodeOptions) {
    this.executor = new ClaudeExecutor();
    this.sessionHandler = new SessionHandler(this.executor);
    this.config = options.config;
    this.systemPrompt = options.systemPrompt || defaultSystemPrompt;
    if (options.sessionId) {
      this.sessionId = options.sessionId;
    }
  }

  /**
   * Handle incoming message with session-driven UI
   *
   * @param session - ChatSession implementation for platform-specific UI
   * @param prompt - User's message/prompt
   * @return The session ID after handling the message
   * @throws {SessionBusyError} If a request is already being processed
   */
  async handleSession(
    session: ChatSession,
    prompt: string,
    sessionId?: string,
    newSession: boolean = false,
  ): Promise<string> {
    if (this.state === "processing") {
      throw new SessionBusyError();
    }

    const options: ClaudeExecuteOptions = {
      prompt,
      config: this.config,
      systemPrompt: this.systemPrompt,
    };

    if (sessionId) {
      options.sessionId = sessionId;
    } else if (!newSession) {
      options.continueSession = true;
    }
    this.state = "processing";
    try {
      const result = await this.sessionHandler.execute(session, options);
      this.state = result.isAwaitingApproval ? "awaiting_approval" : "idle";
      return result.sessionId;
    } catch (error) {
      this.state = "idle";
      throw error;
    }
  }

  clearSession(): void {
    this.sessionId = null;
    this.state = "idle";
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getState(): SessionState {
    return this.state;
  }
}
