import {
  Client,
  GatewayIntentBits,
  type TextChannel,
  type Message,
  type ButtonInteraction,
  Events,
  MessagePayload,
  type MessageCreateOptions,
} from "discord.js";
import {
  ChatConnectionError,
  ChatNotConnectedError,
  SendMessageError,
} from "../errors.js";
import type { DiscordConfig } from "./config.js";
import { type ClaudeCode, SessionBusyError } from "../../claude/index.js";
import { createEmbedMessage } from "./util.js";
import { DiscordSession } from "../../session/discord.js";
import { logDebug, logError, logFailure, logWarn } from "../../logger.js";
import {
  registerCommands,
  handleCommandInteraction,
} from "./commands/index.js";

export class DiscordProvider {
  readonly name = "discord";
  private client: Client | null = null;
  private channel: TextChannel | null = null;

  // Map of approval message ID -> original user message
  private pendingApprovals = new Map<string, Message>();

  constructor(
    private readonly config: DiscordConfig,
    private readonly claudeCode: ClaudeCode,
  ) {}

  async connect(): Promise<void> {
    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });

      // Register message event listener
      this.client.on(Events.MessageCreate, async (message) => {
        try {
          await this.handleMessage(message);
        } catch (error) {
          logError(`Error handling message: ${error}`);
        }
      });

      // Register interaction listener
      this.client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isButton()) {
          try {
            await this.handleButtonInteraction(interaction);
          } catch (error) {
            logError(`Error handling button interaction: ${error}`);
          }
        } else if (interaction.isChatInputCommand()) {
          try {
            await handleCommandInteraction(interaction);
          } catch (error) {
            logError(`Error handling slash command: ${error}`);
          }
        }
      });

      await this.client.login(this.config.apiKey);

      // Fetch the target channel
      const channel = await this.client.channels.fetch(this.config.channelId);
      if (!channel?.isTextBased()) {
        throw new Error("Channel is not a text channel");
      }

      this.channel = channel as TextChannel;

      // Register slash commands
      await registerCommands(this.client, this.config.guildId);
    } catch (error) {
      throw new ChatConnectionError(error instanceof Error ? error : undefined);
    }
  }

  async disconnect(): Promise<void> {
    this.pendingApprovals.clear();

    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.channel = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.isReady();
  }

  async sendTextMessage(message: string): Promise<void> {
    await this.sendMessage(message);
  }

  async sendEmbedMessage(
    content: string,
    isError: boolean = false,
    title?: string,
  ): Promise<void> {
    const embed = createEmbedMessage(content, isError, title);
    await this.sendMessage({ embeds: [embed] });
  }

  private async sendMessage(
    content: string | MessagePayload | MessageCreateOptions,
  ): Promise<Message> {
    if (!this.isConnected() || !this.channel) {
      throw new ChatNotConnectedError();
    }

    try {
      return await this.channel.send(content);
    } catch (error) {
      throw new SendMessageError(error instanceof Error ? error : undefined);
    }
  }

  private formatResponseMessage(content: string): string {
    // Remove mentions (<@userId> or <@!userId>)
    return content.replace(/<@!?\d+>/g, "").trim();
  }

  private async handleButtonInteraction(
    interaction: ButtonInteraction,
  ): Promise<void> {
    if (!interaction.customId.startsWith("continue_")) return;
    if (!this.channel) return;

    const originalMessage = this.pendingApprovals.get(interaction.message.id);
    if (!originalMessage) return;

    await interaction.deferUpdate();

    // Remove button from message
    await interaction.message.edit({ components: [] });

    this.pendingApprovals.delete(interaction.message.id);

    // Create new session and continue
    const session = new DiscordSession(
      originalMessage,
      this.channel,
      (approvalMsgId, origMsg) =>
        this.pendingApprovals.set(approvalMsgId, origMsg),
    );

    try {
      await this.claudeCode.handleSession(session, "OK, continue.");
    } catch (error) {
      logFailure(`Error handling continue: ${error}`);
      await session.fail(
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!this.client || !this.channel) return;

    // Only handle message that mentions the bot
    const botMention = `<@${this.client.user?.id}>`;
    if (!message.content.startsWith(botMention)) {
      return;
    }

    const prompt = this.formatResponseMessage(message.content);

    logDebug(`[Discord] Received message: ${prompt}`);

    const state = this.claudeCode.getState();

    // If awaiting approval, treat this message as a response to the approval request
    if (state === "awaiting_approval") {
      // Clear pending approvals since we're continuing with a new message
      this.pendingApprovals.clear();
    }

    // Create session for Claude CLI interaction
    const session = new DiscordSession(
      message,
      this.channel,
      (approvalMsgId, origMsg) =>
        this.pendingApprovals.set(approvalMsgId, origMsg),
    );

    try {
      await this.claudeCode.handleSession(session, prompt);
    } catch (error) {
      if (error instanceof SessionBusyError) {
        logWarn("Session is busy");
        await message.reply("処理中です。完了までお待ちください。");
        return;
      }
      logFailure(`Error handling message: ${error}`);
      await session.fail(
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  }
}
