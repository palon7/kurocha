import {
  type Message,
  type TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { ChatSession } from "./types.js";
import { ProgressUpdater } from "../providers/discord/progress_updater.js";
import { createEmbedMessage } from "../providers/discord/util.js";

export type OnAwaitingInputCallback = (
  approvalMessageId: string,
  originalMessage: Message,
) => void;

/**
 * Discord implementation of ChatSession
 *
 * Provides Discord-specific UI features:
 * - Progress updates via embed message editing
 * - Final results with embed messages
 * - Approval requests with "Continue" button
 */
export class DiscordSession implements ChatSession {
  private progressUpdater: ProgressUpdater;

  constructor(
    private initialMessage: Message,
    private channel: TextChannel,
    private onAwaitingInput?: OnAwaitingInputCallback,
  ) {
    this.progressUpdater = new ProgressUpdater(2000, channel);
    this.progressUpdater.update("Starting...", "Please wait");
  }

  async updateProgress(text: string, title: string = "Working"): Promise<void> {
    this.progressUpdater.update(text, title, false);
  }

  async complete(result: string): Promise<void> {
    this.progressUpdater.complete();
    const embed = createEmbedMessage(result, false, "✅ Completed");
    await this.initialMessage.reply({ embeds: [embed] });
  }

  async fail(error: Error | string): Promise<void> {
    this.progressUpdater.complete();
    const errorMessage = error instanceof Error ? error.message : error;
    const embed = createEmbedMessage(errorMessage, true, "❌ Error");
    await this.initialMessage.reply({ embeds: [embed] });
  }

  async awaitingInput(prompt: string): Promise<void> {
    this.progressUpdater.complete();

    // Create continue button
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`continue_${this.initialMessage.id}`)
        .setLabel("続行")
        .setStyle(ButtonStyle.Primary),
    );

    const embed = createEmbedMessage(prompt, false, "⏳ 確認待ち");
    const approvalMessage = await this.initialMessage.reply({
      embeds: [embed],
      components: [row],
    });

    // Notify DiscordProvider about pending approval
    this.onAwaitingInput?.(approvalMessage.id, this.initialMessage);
  }
}
