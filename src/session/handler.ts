import type { IClaudeExecutor } from "../claude/executor.js";
import type {
  ClaudeExecuteOptions,
  ClaudeExecuteResult,
  ClaudeStreamEvent,
  ClaudeMessageContent,
} from "../claude/types.js";
import { logError } from "../logger.js";
import type { ChatSession } from "./types.js";

const ASK_APPROVAL_TAG = "[ask_approval]";

/** Tool name → parameter key to display */
const TOOL_DISPLAY_PARAM: Record<string, string> = {
  Read: "file_path",
  Edit: "file_path",
  Write: "file_path",
  Bash: "command",
  Glob: "pattern",
  Grep: "pattern",
};

/**
 * SessionHandler bridges ClaudeExecutor and ChatSession
 *
 * Responsibilities:
 * - Listen to executor events and update session accordingly
 * - Detect [ask_approval] tag and trigger awaitingInput()
 * - Format message content for progress display
 */
export class SessionHandler {
  constructor(private executor: IClaudeExecutor) {}

  async execute(
    session: ChatSession,
    options: ClaudeExecuteOptions,
  ): Promise<ClaudeExecuteResult> {
    const onAssistant = (event: ClaudeStreamEvent) => {
      if (event.type === "assistant") {
        const content = this.formatMessageContent(event.message.content);
        session.updateProgress(content).catch(logError);
      }
    };

    try {
      const executorResult = await this.executor.execute(options, onAssistant);
      const isAwaitingApproval =
        executorResult.response.includes(ASK_APPROVAL_TAG);

      // Determine session outcome based on result
      if (isAwaitingApproval) {
        // Approval request - remove tag and show approval UI
        const prompt = executorResult.response
          .replace(ASK_APPROVAL_TAG, "")
          .trim();
        await session.awaitingInput(prompt);
      } else if (executorResult.isError) {
        await session.fail(executorResult.response);
      } else {
        await session.complete(executorResult.response);
      }

      return {
        sessionId: executorResult.sessionId,
        response: executorResult.response,
        isAwaitingApproval,
      };
    } catch (error) {
      await session.fail(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private formatMessageContent(contents: ClaudeMessageContent[]): string {
    const parts: string[] = [];

    for (const content of contents) {
      if (content.type === "text") {
        parts.push(content.text);
      } else if (content.type === "tool_use") {
        const paramKey = TOOL_DISPLAY_PARAM[content.name];
        let param = "";
        if (paramKey && typeof content.input[paramKey] === "string") {
          param = content.input[paramKey] as string;
          if (content.name === "Bash" && param.length > 50) {
            param = param.substring(0, 47) + "...";
          }
        }
        parts.push(`🔧 [${content.name}]${param ? ` ${param}` : ""}`);
      }
    }

    let result = parts.join("\n\n").trim() || "Processing...";

    // Limit to 300 characters
    if (result.length > 300) {
      result = result.substring(0, 297) + "...";
    }

    return result;
  }
}
