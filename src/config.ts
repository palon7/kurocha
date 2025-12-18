import "dotenv/config";
import { logError } from "./logger.js";

interface EnvConfig {
  discordToken: string;
  discordChannelId: string;
  discordGuildId: string;
  workspaceRoot: string;
  skipPermissions: boolean;
  timeoutMs: number | undefined;
}

export function loadEnvConfig(): EnvConfig {
  const discordToken = process.env.DISCORD_API_KEY;
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;
  const discordGuildId = process.env.DISCORD_GUILD_ID;
  const workspaceRoot = process.env.WORKSPACE_ROOT;
  const skipPermissions = process.env.CLAUDE_SKIP_PERMISSIONS === "true";
  const timeoutMs = process.env.CLAUDE_TIMEOUT_MS
    ? parseInt(process.env.CLAUDE_TIMEOUT_MS, 10)
    : undefined;

  if (!discordToken || !discordChannelId || !discordGuildId) {
    logError(
      "Error: DISCORD_API_KEY, DISCORD_CHANNEL_ID, and DISCORD_GUILD_ID must be set",
    );
    process.exit(1);
  }

  if (!workspaceRoot) {
    logError("Error: WORKSPACE_ROOT must be set");
    process.exit(1);
  }

  return {
    discordToken,
    discordChannelId,
    discordGuildId,
    workspaceRoot,
    skipPermissions,
    timeoutMs,
  };
}
