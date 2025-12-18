import {
  type ChatInputCommandInteraction,
  type Client,
  Collection,
  REST,
  Routes,
} from "discord.js";
import type { SlashCommand } from "./types.js";
import { workspaceCommand } from "./workspace.js";
import { logError, logInfo } from "../../../logger.js";

const commands: SlashCommand[] = [workspaceCommand];

const commandCollection = new Collection<string, SlashCommand>();
for (const command of commands) {
  commandCollection.set(command.data.name, command);
}

export async function registerCommands(
  client: Client,
  guildId: string,
): Promise<void> {
  if (!client.user) {
    throw new Error("Client user is not available");
  }

  const rest = new REST().setToken(client.token!);
  const commandData = commands.map((cmd) => cmd.data.toJSON());

  logInfo(`Registering ${commands.length} slash command(s)...`);

  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
    body: commandData,
  });

  logInfo("Slash commands registered successfully");
}

export async function handleCommandInteraction(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const command = commandCollection.get(interaction.commandName);

  if (!command) {
    logError(`Unknown command: ${interaction.commandName}`);
    await interaction.reply({
      content: "Unknown command",
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logError(`Error executing command ${interaction.commandName}: ${error}`);

    const errorMessage = "An error occurred while executing this command.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
