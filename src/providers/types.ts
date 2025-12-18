/**
 * Message handler function that processes incoming messages
 * @param prompt - The user's message prompt
 * @returns The response to send back
 */
export type MessageHandler = (prompt: string) => Promise<string>;

export abstract class ChatProvider {
  abstract readonly name: string;

  constructor(protected readonly messageHandler: MessageHandler) {}

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;
  abstract sendMessage(message: string): Promise<void>;
}

export type ChatProviderType = "discord";
