import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { WorkspaceManager } from "../../../workspace/index.js";
import { logError } from "../../../logger.js";

async function handleCurrent(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const workspaceManager = WorkspaceManager.getInstance();
  const current = workspaceManager.getCurrentWorkspace();
  await interaction.reply(
    `**Current workspace:** \`${current.name}\`\nPath: ${current.path}`,
  );
}

async function handleList(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const workspaceManager = WorkspaceManager.getInstance();
  const workspaces = await workspaceManager.listWorkspaces();
  const current = workspaceManager.getCurrentWorkspace();

  if (workspaces.length === 0) {
    await interaction.reply("No workspaces available.");
    return;
  }

  const list = workspaces
    .map((ws) => {
      const isCurrent = ws.name === current.name;
      const marker = isCurrent ? "**→**" : "  ";
      return `${marker} \`${ws.name}\` - ${ws.path}`;
    })
    .join("\n");

  await interaction.reply(`**Workspaces:**\n${list}`);
}

async function handleCreate(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const name = interaction.options.getString("name", true);
  const workspaceManager = WorkspaceManager.getInstance();

  const workspace = await workspaceManager.createWorkspace(name);
  await workspaceManager.switchWorkspace(name);

  await interaction.reply(
    `✅ Created and switched workspace \`${workspace.name}\`\nPath: ${workspace.path}`,
  );
}

async function handleSwitch(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const name = interaction.options.getString("name", true);
  const workspaceManager = WorkspaceManager.getInstance();

  const workspace = await workspaceManager.switchWorkspace(name);

  await interaction.reply(
    `✅ Switched to workspace \`${workspace.name}\`\nPath: ${workspace.path}`,
  );
}

export const workspaceCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("workspace")
    .setDescription("Manage workspaces")
    .addSubcommand((sub) =>
      sub.setName("current").setDescription("Show current workspace"),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all workspaces"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new workspace")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Workspace name")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("switch")
        .setDescription("Switch to a workspace")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Workspace name")
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "current":
          await handleCurrent(interaction);
          break;
        case "list":
          await handleList(interaction);
          break;
        case "create":
          await handleCreate(interaction);
          break;
        case "switch":
          await handleSwitch(interaction);
          break;
        default:
          await interaction.reply({
            content: `Unknown subcommand: ${subcommand}`,
            ephemeral: true,
          });
      }
    } catch (error) {
      logError(`Error handling workspace command: ${error}`);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred.";

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `❌ Error: ${errorMessage}`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: `❌ Error: ${errorMessage}`,
          ephemeral: true,
        });
      }
    }
  },
};
