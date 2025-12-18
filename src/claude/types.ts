export interface ClaudeConfig {
  workingDirectory?: string | undefined;
  mcpConfigPath?: string | undefined;
  dangerouslySkipPermissions?: boolean | undefined;
  timeoutMs?: number | undefined;
}

export type ClaudeMessageContent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
    };

export interface ClaudeAPIMessage {
  id: string;
  type: "message";
  role: "assistant" | "user";
  model: string;
  content: ClaudeMessageContent[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Stream JSON event types from Claude CLI
 * https://docs.anthropic.com/claude-cli/reference/output-formats
 */
export type ClaudeStreamEvent =
  | {
      type: "system";
      subtype: "init";
      session_id: string;
      [key: string]: unknown;
    }
  | {
      type: "assistant";
      message: ClaudeAPIMessage;
      session_id: string;
      [key: string]: unknown;
    }
  | {
      type: "user";
      message: {
        role: "user";
        content: ClaudeMessageContent[];
      };
      session_id: string;
      [key: string]: unknown;
    }
  | {
      type: "result";
      subtype: "success" | "error_max_turns" | "error_during_execution";
      is_error: boolean;
      result: string;
      session_id: string;
      total_cost_usd: number;
      duration_ms: number;
      duration_api_ms: number;
      usage: {
        input_tokens: number;
        cache_creation_input_tokens: number;
        cache_read_input_tokens: number;
        output_tokens: number;
        server_tool_use: {
          web_search_requests: number;
          web_fetch_requests: number;
        };
        service_tier: string;
        cache_creation: {
          ephemeral_1h_input_tokens: number;
          ephemeral_5m_input_tokens: number;
        };
      };
      [key: string]: unknown;
    };

export interface ClaudeExecuteOptions {
  prompt: string;
  sessionId?: string;
  config: ClaudeConfig;
  systemPrompt: string;
  continueSession?: boolean;
}

export interface ClaudeExecuteResult {
  sessionId: string;
  response: string;
  isAwaitingApproval: boolean;
}
