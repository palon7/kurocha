/**
 * ChatSession interface for platform-specific UI implementations
 *
 * This interface abstracts the communication with users during Claude CLI execution.
 * Each platform (Discord, Slack, CLI, etc.) implements this interface to provide
 * platform-specific UI features while maintaining a consistent API for the core logic.
 */
export interface ChatSession {
  /**
   * Update progress message during Claude CLI execution
   * Platform may update existing message in-place (e.g., Discord embed edit)
   *
   * @param text - Progress content to display
   * @param title - Optional title/status (e.g., "Working", "Running tests")
   */
  updateProgress(text: string, title?: string): Promise<void>;

  /**
   * Mark session as completed with final result
   * Platform should replace progress message with final result
   *
   * @param result - Final result text
   */
  complete(result: string): Promise<void>;

  /**
   * Mark session as failed with error
   * Platform should display error and clean up
   *
   * @param error - Error object or message
   */
  fail(error: Error | string): Promise<void>;

  /**
   * Show approval request with continue button
   * User can either click button or reply with custom message
   * Next user input will trigger a new handleSession() call with --resume
   *
   * @param prompt - Message explaining what approval is needed for
   */
  awaitingInput(prompt: string): Promise<void>;
}
