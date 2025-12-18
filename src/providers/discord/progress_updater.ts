import { type Message, type TextChannel } from "discord.js";
import { throttle, type ThrottledFunction } from "es-toolkit/function";
import { createEmbedMessage } from "./util.js";
import { logError } from "../../logger.js";

export class ProgressUpdater {
  private lastMessage: Message | null = null;
  private isCompleted: boolean = false;
  private throttledUpdateDiscord: ThrottledFunction<
    (text: string, title: string, isError: boolean) => Promise<void>
  >;

  constructor(
    delayMs: number,
    private readonly channel: TextChannel,
  ) {
    this.throttledUpdateDiscord = throttle(
      this.updateDiscord.bind(this),
      delayMs,
    );
  }

  update(text: string, title: string, isError: boolean = false) {
    // Reset completion flag when starting new updates
    if (this.isCompleted) {
      this.isCompleted = false;
      this.lastMessage = null;
    }
    this.throttledUpdateDiscord(text, title, isError);
  }

  complete() {
    if (this.isCompleted) return; // Already completed, avoid redundant operations
    // Flush any pending throttled updates before marking as complete
    this.throttledUpdateDiscord.flush();
    // Mark as completed to prevent further edits to this message
    this.isCompleted = true;
  }

  private hasNewMessage(): boolean {
    const channelLastMessageId = this.channel.lastMessageId;
    return !!(
      this.lastMessage &&
      channelLastMessageId &&
      this.lastMessage.id !== channelLastMessageId
    );
  }

  private async updateDiscord(text: string, title: string, isError: boolean) {
    const embed = createEmbedMessage(text, isError, title);
    const messageOption = { embeds: [embed] };

    try {
      if (this.lastMessage) {
        if (this.hasNewMessage()) {
          // Stick message
          await this.lastMessage.delete();
          this.lastMessage = await this.channel.send(messageOption);
        } else {
          await this.lastMessage.edit(messageOption);
        }
      } else {
        // No active message, send new message
        this.lastMessage = await this.channel.send(messageOption);
      }
    } catch (error) {
      logError(`Failed to update progress message: ${error}`);
    }
  }
}
