export class ChatProviderError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "ChatProviderError";
  }
}

export class ChatNotConnectedError extends ChatProviderError {
  constructor() {
    super("Chat provider is not connected");
    this.name = "ChatNotConnectedError";
  }
}

export class ChatConnectionError extends ChatProviderError {
  constructor(cause?: Error) {
    super("Failed to connect to chat provider", cause);
    this.name = "ChatConnectionError";
  }
}

export class SendMessageError extends ChatProviderError {
  constructor(cause?: Error) {
    super("Failed to send message", cause);
    this.name = "SendMessageError";
  }
}
