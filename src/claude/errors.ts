export class ClaudeError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "ClaudeError";
  }
}

export class ClaudeExecuteFailedError extends ClaudeError {
  exitCode: number;
  errorOutput: string | null = null;

  constructor(exitCode: number, errorOutput: string) {
    super("Claude execution failed: exit code " + exitCode);
    this.name = "ClaudeExecuteFailedError";
    this.exitCode = exitCode;
    this.errorOutput = errorOutput;
  }
}

export class SessionBusyError extends ClaudeError {
  constructor() {
    super("Session is currently processing another request");
    this.name = "SessionBusyError";
  }
}

export class ClaudeTimeoutError extends ClaudeError {
  constructor(timeoutMs: number) {
    super(`Claude CLI execution timed out after ${timeoutMs}ms`);
    this.name = "ClaudeTimeoutError";
  }
}
