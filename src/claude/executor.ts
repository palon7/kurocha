import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { EventEmitter } from "node:events";
import type { ClaudeExecuteOptions, ClaudeStreamEvent } from "./types.js";
import { WorkspaceManager } from "../workspace/index.js";
import { ClaudeExecuteFailedError, ClaudeTimeoutError } from "./errors.js";
import { logDebug, logError, logFailure } from "../logger.js";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface ExecutorResult {
  sessionId: string;
  response: string;
  isError: boolean;
}

export type AssistantEventHandler = (event: ClaudeStreamEvent) => void;

export interface IClaudeExecutor {
  execute(
    options: ClaudeExecuteOptions,
    onAssistant?: AssistantEventHandler,
  ): Promise<ExecutorResult>;
}

/**
 * Claude CLI executor
 * Executes Claude CLI and returns the final result
 * Emits events:
 * - 'assistant': When assistant message is received (args: event: ClaudeStreamEvent)
 * - 'result': When final result is received (args: event: ClaudeStreamEvent)
 */
export class ClaudeExecutor extends EventEmitter implements IClaudeExecutor {
  constructor() {
    super();
  }

  async execute(
    options: ClaudeExecuteOptions,
    onAssistant?: AssistantEventHandler,
  ): Promise<ExecutorResult> {
    const args = this.buildCliArguments(options);
    const timeoutMs = options.config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Get working directory from WorkspaceManager if not specified
    const workingDirectory =
      options.config?.workingDirectory ??
      WorkspaceManager.getInstance().getCurrentWorkspaceDirectory();

    logDebug(`[CLI] Executing command: claude ${args.join(" ")}`);

    const childProcess = spawn("claude", args, {
      cwd: workingDirectory,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdout = createInterface({
      input: childProcess.stdout,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    const stderr = createInterface({
      input: childProcess.stderr,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    let lastSessionId = "";
    let finalResult = "";
    let isError = false;
    const errors: string[] = [];
    let timedOut = false;

    // Setup timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      this.killProcess(childProcess);
    }, timeoutMs);

    try {
      // Collect stderr
      stderr.on("line", (line) => {
        errors.push(line);
      });

      // Handle stream errors to prevent unhandled error events
      stdout.on("error", (err) => {
        logError(`[CLI] stdout error: ${err}`);
      });
      stderr.on("error", (err) => {
        logError(`[CLI] stderr error: ${err}`);
      });

      // Collect stdout line by line
      for await (const line of stdout) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as ClaudeStreamEvent;

          this.printEvent(event, onAssistant);

          // Update session ID
          if ("session_id" in event) {
            lastSessionId = event.session_id;
          }

          // Extract final result from result event
          if (event.type === "result") {
            finalResult = event.result;
            isError = event.is_error;
          }
        } catch {
          logError(`[CLI] Failed to parse line: ${line}`);
        }
      }

      // Wait for process to exit
      const exitCode = await new Promise<number | null>((resolve) => {
        childProcess.on("close", (code) => {
          resolve(code);
        });
      });

      if (timedOut) {
        throw new ClaudeTimeoutError(timeoutMs);
      }

      if (exitCode !== 0) {
        throw new ClaudeExecuteFailedError(exitCode ?? -1, errors.join("\n"));
      }

      return {
        sessionId: lastSessionId,
        response: finalResult,
        isError,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private killProcess(childProcess: ChildProcess): void {
    logFailure("[CLI] Killing process due to timeout");
    childProcess.kill("SIGTERM");
    // Force kill after 5 seconds if still running
    const forceKillTimer = setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill("SIGKILL");
      }
    }, 5000);
    // Clear timer when process exits to prevent memory leak
    childProcess.once("close", () => {
      clearTimeout(forceKillTimer);
    });
  }

  private printEvent(
    event: ClaudeStreamEvent,
    onAssistant?: AssistantEventHandler,
  ): void {
    switch (event.type) {
      case "system":
        logDebug(`[CLI] System: ${JSON.stringify(event.session_id)}`);
        break;
      case "user":
        logDebug(`[CLI] User: ${JSON.stringify(event.message.content)}`);
        break;
      case "assistant":
        logDebug(`[CLI] Assistant: ${JSON.stringify(event.message.content)}`);
        this.emit("assistant", event);
        onAssistant?.(event);
        break;
      case "result":
        this.emit("result", event);
        break;
    }
  }

  private buildCliArguments(options: ClaudeExecuteOptions): string[] {
    const args: string[] = [];

    // Use headless mode
    args.push("-p");
    args.push(options.prompt);

    args.push("--output-format", "stream-json");
    args.push("--verbose");

    args.push("--append-system-prompt", options.systemPrompt);

    if (options.sessionId) {
      args.push("--resume", options.sessionId);
    } else if (options.continueSession) {
      args.push("-c");
    }

    if (options.config?.mcpConfigPath) {
      args.push("--mcp-config", options.config.mcpConfigPath);
    }

    if (options.config?.dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    return args;
  }
}
