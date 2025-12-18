import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionHandler } from "./handler.js";
import type { ChatSession } from "./types.js";
import type {
  ClaudeExecuteOptions,
  ClaudeStreamEvent,
  ClaudeMessageContent,
  ClaudeAPIMessage,
} from "../claude/types.js";
import type {
  IClaudeExecutor,
  ExecutorResult,
  AssistantEventHandler,
} from "../claude/executor.js";

function createMockSession(): ChatSession & {
  updateProgress: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
  fail: ReturnType<typeof vi.fn>;
  awaitingInput: ReturnType<typeof vi.fn>;
} {
  return {
    updateProgress: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    awaitingInput: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockExecutor(): IClaudeExecutor & {
  execute: ReturnType<
    typeof vi.fn<
      (
        options: ClaudeExecuteOptions,
        onAssistant?: AssistantEventHandler
      ) => Promise<ExecutorResult>
    >
  >;
} {
  return {
    execute: vi.fn(),
  };
}

function createMockMessage(content: ClaudeMessageContent[]): ClaudeAPIMessage {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-20250514",
    content,
    stop_reason: null,
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
    },
  };
}

function createAssistantEvent(
  content: ClaudeMessageContent[],
): ClaudeStreamEvent {
  return {
    type: "assistant",
    session_id: "test-session-id",
    message: createMockMessage(content),
  };
}

describe("SessionHandler", () => {
  let handler: SessionHandler;
  let mockExecutor: ReturnType<typeof createMockExecutor>;
  let mockSession: ReturnType<typeof createMockSession>;

  const options: ClaudeExecuteOptions = {
    prompt: "test prompt",
    config: {},
    systemPrompt: "test system prompt",
  };

  beforeEach(() => {
    mockExecutor = createMockExecutor();
    mockSession = createMockSession();
    handler = new SessionHandler(mockExecutor);
  });

  describe("execute()", () => {
    it("calls session.complete and returns result on success", async () => {
      mockExecutor.execute.mockResolvedValue({
        sessionId: "session-123",
        response: "Task completed",
        isError: false,
      });

      const returned = await handler.execute(mockSession, options);

      expect(returned.sessionId).toBe("session-123");
      expect(returned.response).toBe("Task completed");
      expect(returned.isAwaitingApproval).toBe(false);
      expect(mockSession.complete).toHaveBeenCalledWith("Task completed");
    });

    it("calls session.awaitingInput when [ask_approval] tag is present", async () => {
      mockExecutor.execute.mockResolvedValue({
        sessionId: "test-session-id",
        response: "Should I proceed? [ask_approval]",
        isError: false,
      });

      const returned = await handler.execute(mockSession, options);

      expect(returned.sessionId).toBe("test-session-id");
      expect(returned.isAwaitingApproval).toBe(true);
      // [ask_approval] tag should be removed when passed to awaitingInput
      expect(mockSession.awaitingInput).toHaveBeenCalledWith(
        "Should I proceed?",
      );
      expect(mockSession.complete).not.toHaveBeenCalled();
    });

    it("calls session.fail when result.isError is true", async () => {
      mockExecutor.execute.mockResolvedValue({
        sessionId: "test-session-id",
        response: "Something went wrong",
        isError: true,
      });

      await handler.execute(mockSession, options);

      expect(mockSession.fail).toHaveBeenCalledWith("Something went wrong");
      expect(mockSession.complete).not.toHaveBeenCalled();
    });

    it("calls session.fail and rethrows on executor error", async () => {
      const error = new Error("Execution failed");
      mockExecutor.execute.mockRejectedValue(error);

      await expect(handler.execute(mockSession, options)).rejects.toThrow(
        "Execution failed",
      );
      expect(mockSession.fail).toHaveBeenCalled();
    });
  });

  describe("progress updates", () => {
    it("calls updateProgress with text content", async () => {
      mockExecutor.execute.mockImplementation(async (_options, onAssistant) => {
        onAssistant?.(
          createAssistantEvent([{ type: "text", text: "Processing..." }])
        );
        return { sessionId: "test-session-id", response: "Done", isError: false };
      });

      await handler.execute(mockSession, options);

      expect(mockSession.updateProgress).toHaveBeenCalledWith("Processing...");
    });

    it("calls updateProgress with tool name for tool_use content", async () => {
      mockExecutor.execute.mockImplementation(async (_options, onAssistant) => {
        onAssistant?.(
          createAssistantEvent([
            {
              type: "tool_use",
              id: "tool_1",
              name: "Read",
              input: { file_path: "/src/index.ts" },
            },
          ])
        );
        return { sessionId: "test-session-id", response: "Done", isError: false };
      });

      await handler.execute(mockSession, options);

      const callArg = mockSession.updateProgress.mock.calls[0]?.[0] as string;
      expect(callArg).toContain("[Read]");
    });
  });
});
