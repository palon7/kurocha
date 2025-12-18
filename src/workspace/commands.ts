import { logError } from "../logger.js";
import { WorkspaceManager } from "./index.js";

/**
 * Workspace command operations
 * These functions are provider-agnostic and can be used from any message handler
 */

async function createWorkspace(name: string): Promise<string> {
  const workspaceManager = WorkspaceManager.getInstance();
  const workspace = await workspaceManager.createWorkspace(name);
  await workspaceManager.switchWorkspace(name);
  return `✅ Created and switched workspace \`${workspace.name}\`\nPath: ${workspace.path}`;
}

async function switchWorkspace(name: string): Promise<string> {
  const workspaceManager = WorkspaceManager.getInstance();
  const workspace = await workspaceManager.switchWorkspace(name);
  return `✅ Switched to workspace \`${workspace.name}\`\nPath: ${workspace.path}`;
}

async function listWorkspaces(): Promise<string> {
  const workspaceManager = WorkspaceManager.getInstance();
  const workspaces = await workspaceManager.listWorkspaces();
  const current = workspaceManager.getCurrentWorkspace();

  if (workspaces.length === 0) {
    return "No workspaces available.";
  }

  const list = workspaces
    .map((ws) => {
      const isCurrent = ws.name === current.name;
      const marker = isCurrent ? "**→**" : "  ";
      return `${marker} \`${ws.name}\` - ${ws.path}`;
    })
    .join("\n");

  return `**Workspaces:**\n${list}`;
}

function getCurrentWorkspace(): string {
  const workspaceManager = WorkspaceManager.getInstance();
  const current = workspaceManager.getCurrentWorkspace();
  return `**Current workspace:** \`${current.name}\`\nPath: ${current.path}`;
}

async function checkWorkspaceExists(name: string): Promise<boolean> {
  const workspaceManager = WorkspaceManager.getInstance();
  return await workspaceManager.hasWorkspace(name);
}

/**
 * Handle workspace command and return response message
 * @param commandText - Full command text (e.g., "!workspace list")
 * @returns Response message
 */
export async function handleWorkspaceCommand(
  commandText: string,
): Promise<string> {
  try {
    const parts = commandText.trim().split(/\s+/);

    // No arguments - show current workspace
    if (parts.length < 2) {
      return getCurrentWorkspace();
    }

    const subcommand = parts[1]!.toLowerCase();

    switch (subcommand) {
      case "create": {
        if (parts.length < 3 || !parts[2]) {
          return "Usage: `!workspace create <name>`";
        }
        return await createWorkspace(parts[2]);
      }

      case "switch": {
        if (parts.length < 3 || !parts[2]) {
          return "Usage: `!workspace switch <name>`";
        }
        return await switchWorkspace(parts[2]);
      }

      case "list": {
        return await listWorkspaces();
      }

      case "current": {
        return getCurrentWorkspace();
      }

      default: {
        // Try smart workspace switching
        if (await checkWorkspaceExists(subcommand)) {
          return await switchWorkspace(subcommand);
        }
        return `Unknown subcommand or workspace: ${subcommand}\nAvailable commands: create, switch, list, current`;
      }
    }
  } catch (error) {
    logError(`Error handling workspace command: ${error}`);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred.";
    return `❌ Error: ${errorMessage}`;
  }
}
