import { DiscordProvider } from "./providers/discord/index.js";
import { ClaudeCode } from "./claude/index.js";
import { WorkspaceManager } from "./workspace/index.js";
import { loadEnvConfig } from "./config.js";
import { log, logError, logInfo, logSuccess } from "./logger.js";
import type { WorkspaceInitWarning } from "./workspace/types.js";

function setupSignalHandlers(cleanup: () => Promise<void>): void {
  const handler = async () => {
    logInfo("\nShutting down...");
    await cleanup();
    process.exit(0);
  };

  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}

function sendWorkspaceWarnings(
  discordProvider: DiscordProvider,
  warnings: WorkspaceInitWarning[],
): void {
  try {
    warnings.forEach(async (warning) => {
      if (warning.type === "not_found") {
        await discordProvider.sendTextMessage(
          `⚠️ Saved workspace "${warning.savedName}" was not found. Fell back to default workspace "${warning.fallbackName}".`,
        );
      } else if (warning.type === "invalid_name") {
        await discordProvider.sendTextMessage(
          `⚠️ Saved workspace "${warning.savedName}" has an invalid name. Fell back to default workspace "${warning.fallbackName}".`,
        );
      }
    });
  } catch (error) {
    logError(`Failed to send workspace warnings: ${error}`);
  }
}

async function main() {
  const config = loadEnvConfig();

  const workspaceManager = WorkspaceManager.getInstance({
    rootDirectory: config.workspaceRoot,
  });

  const initResult = await workspaceManager.initialize();

  const claude = new ClaudeCode({
    config: {
      dangerouslySkipPermissions: config.skipPermissions || undefined,
      timeoutMs: config.timeoutMs,
    },
  });

  workspaceManager.on("switched", () => {
    claude.clearSession();
  });

  const discordProvider = new DiscordProvider(
    {
      apiKey: config.discordToken,
      channelId: config.discordChannelId,
      guildId: config.discordGuildId,
    },
    claude,
  );

  logInfo("Connecting to Discord...");
  await discordProvider.connect();

  logSuccess("Connected to Discord successfully");

  // Send notification if saved workspace was not found
  sendWorkspaceWarnings(discordProvider, initResult.warnings);

  log(`Listening on channel: ${config.discordChannelId}`, {
    level: "info",
    icon: "started",
  });

  setupSignalHandlers(() => discordProvider.disconnect());
}

main().catch((error) => {
  logError(`Fatal error: ${error}`);
  process.exit(1);
});
