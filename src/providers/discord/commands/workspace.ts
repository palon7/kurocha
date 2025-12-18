import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { WorkspaceManager } from "../../../workspace/index.js";
import { logError } from "../../../logger.js";

const handlers = {
  current: handleCurrent,
  list: handleList,
  create: handleCreate,
  switch: handleSwitch,
} as const;


type HandlerContext = {
  interaction: ChatInputCommandInteraction;
  workspaceManager: WorkspaceManager;
};

async function handleCurrent(
  ctx: HandlerContext,
): Promise<void> {
  const workspaceManager = ctx.workspaceManager;
  const current = workspaceManager.getCurrentWorkspace();
  await ctx.interaction.reply(
    `**Current workspace:** \`${current.name}\``,
  );
}

async function handleList(
  ctx: HandlerContext,
): Promise<void> {
  const workspaces = await ctx.workspaceManager.listWorkspaces();
  const current = ctx.workspaceManager.getCurrentWorkspace();

  if (workspaces.length === 0) {
    await ctx.interaction.reply("No workspaces available.");
    return;
  }

  const list = workspaces
    .map((ws) => {
      const isCurrent = ws.name === current.name;
      const marker = isCurrent ? "**→**" : "  ";
      return `${marker} \`${ws.name}\``;
    })
    .join("\n");

  await ctx.interaction.reply(`**Workspaces:**\n${list}`);
}

async function handleCreate(
  ctx: HandlerContext,
): Promise<void> {
  const name = ctx.interaction.options.getString("name", true);

  const workspace = await ctx.workspaceManager.createWorkspace(name, true);

  await ctx.interaction.reply(
    `✅ Created and switched workspace \`${workspace.name}\``,
  );
}

async function handleSwitch(
  ctx: HandlerContext,
): Promise<void> {
  const name = ctx.interaction.options.getString("name", true);

  const workspace = await ctx.workspaceManager.switchWorkspace(name);
  await ctx.interaction.reply(
    `✅ Switched to workspace \`${workspace.name}\``,
  );
}

function buildSubcommand(): SlashCommandBuilder {
  const builder = new SlashCommandBuilder()
    .setName("workspace")
    .setDescription("Manage workspaces");

  builder.addSubcommand((sub) =>
      sub.setName("current").setDescription("Show current workspace"),
    );
  builder.addSubcommand((sub) =>
      sub.setName("list").setDescription("List all workspaces"),
    );
  builder.addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new workspace")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Workspace name")
            .setRequired(true),
        ),
    );
  builder.addSubcommand((sub) =>
      sub
        .setName("switch")
        .setDescription("Switch to a workspace")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Workspace name")
            .setRequired(true),
        ),
    );

  return builder;
}

export const workspaceCommand: SlashCommand = {
  data: buildSubcommand(),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand() as keyof typeof handlers;
    const handler = handlers[subcommand];
    const context = {
      interaction,
      workspaceManager: WorkspaceManager.getInstance(),
    };

    if (!handler) {
      logError(`No handler found for subcommand: ${subcommand}`);
      return;
    }

    await handler(context);
  },
};
