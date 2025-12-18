import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { z } from "zod";

/**
 * Workspace state schema for validation
 */
const WorkspaceStateSchema = z.object({
  currentWorkspace: z.string().min(1),
});

/**
 * Workspace state that is persisted to disk
 */
type WorkspaceState = z.infer<typeof WorkspaceStateSchema>;

/**
 * Manages persistence of workspace state to ~/.chat_claude.json
 */
export class WorkspacePersistence {
  private readonly statePath: string;

  constructor() {
    this.statePath = path.join(os.homedir(), ".chat_claude.json");
  }

  /**
   * Load the last used workspace from disk
   * Returns null if the state file doesn't exist or contains invalid data
   */
  async loadState(): Promise<WorkspaceState | null> {
    try {
      const content = await readFile(this.statePath, "utf-8");
      const parsed = JSON.parse(content);

      // Validate the parsed data against the schema
      const result = WorkspaceStateSchema.safeParse(parsed);
      if (!result.success) {
        console.error("Invalid workspace state format:", result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      // File doesn't exist
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      // Other errors (permission issues, invalid JSON, etc.)
      console.error("Failed to load workspace state:", error);
      return null;
    }
  }

  /**
   * Save the current workspace to disk
   * Throws an error if the save operation fails
   */
  async saveState(workspaceName: string): Promise<void> {
    const state: WorkspaceState = {
      currentWorkspace: workspaceName,
    };

    try {
      await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save workspace state:", error);
      // Don't throw to avoid crashing the application
      // Workspace persistence is a non-critical feature
    }
  }
}
