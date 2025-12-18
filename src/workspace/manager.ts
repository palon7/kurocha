import { mkdir, access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import type {
  Workspace,
  WorkspaceConfig,
  WorkspaceInitializeResult,
  WorkspaceInitWarning,
} from "./types.js";
import { WorkspacePersistence } from "./persistence.js";
import { logWarn } from "../logger.js";

/**
 * Workspace manager
 * Manages multiple workspaces under a root directory
 * All workspace data is stored on the filesystem as directories
 * Emits events:
 * - 'switched': When workspace is switched (args: workspace: Workspace)
 */
export class WorkspaceManager extends EventEmitter {
  private static instance: WorkspaceManager | null = null;
  private currentWorkspaceName: string = "default";
  private readonly rootDirectory: string;
  private readonly persistence: WorkspacePersistence;

  private constructor(config: WorkspaceConfig) {
    super();
    this.rootDirectory = config.rootDirectory;
    this.persistence = new WorkspacePersistence();
  }

  static getInstance(config?: WorkspaceConfig): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      if (!config) {
        throw new Error(
          "WorkspaceManager must be initialized with config on first call",
        );
      }
      WorkspaceManager.instance = new WorkspaceManager(config);
    }
    return WorkspaceManager.instance;
  }

  async initialize(): Promise<WorkspaceInitializeResult> {
    const warnings: WorkspaceInitWarning[] = [];
    // Create root directory if it doesn't exist
    await mkdir(this.rootDirectory, { recursive: true });

    // Check if default workspace exists, create if not
    const defaultPath = path.join(this.rootDirectory, "default");
    try {
      await access(defaultPath);
    } catch {
      await this.createWorkspace("default");
    }

    // Try to restore last used workspace from persistent state
    const state = await this.persistence.loadState();
    if (state?.currentWorkspace) {
      // Validate the workspace name from the saved state
      try {
        this.validateWorkspaceName(state.currentWorkspace);
      } catch (error) {
        logWarn(
          `Saved workspace "${state.currentWorkspace}" has invalid name. Falling back to "default". Error: ${error}`,
        );
        this.currentWorkspaceName = "default";
        await this.persistence.saveState("default");
        warnings.push({
          type: "invalid_name",
          savedName: state.currentWorkspace,
          fallbackName: "default",
        });
      }

      const workspaceExists = await this.hasWorkspace(state.currentWorkspace);
      if (workspaceExists) {
        this.currentWorkspaceName = state.currentWorkspace;
      } else {
        // Workspace no longer exists, fall back to default and notify
        logWarn(
          `Saved workspace "${state.currentWorkspace}" no longer exists. Falling back to "default".`,
        );
        this.currentWorkspaceName = "default";
        await this.persistence.saveState("default");
        warnings.push({
          type: "not_found",
          savedName: state.currentWorkspace,
          fallbackName: "default",
        });
      }
    } else {
      // No saved state, use default
      this.currentWorkspaceName = "default";
      await this.persistence.saveState("default");
    }
    return { warnings };
  }

  private validateWorkspaceName(name: string): void {
    if (!name || name.length === 0) {
      throw new Error("Workspace name cannot be empty");
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(
        "Workspace name can only contain alphanumeric characters, hyphens, and underscores",
      );
    }

    // Check for reserved names
    const reserved = [".", "..", "/", "\\"];
    if (reserved.includes(name)) {
      throw new Error(`Workspace name "${name}" is reserved`);
    }

    // Check length
    if (name.length > 255) {
      throw new Error("Workspace name is too long (max 255 characters)");
    }
  }

  async createWorkspace(name: string, switchTo: boolean = false): Promise<Workspace> {
    this.validateWorkspaceName(name);

    const workspacePath = path.join(this.rootDirectory, name);

    // Check if directory already exists
    try {
      await access(workspacePath);
      throw new Error(`Workspace "${name}" already exists`);
    } catch (error) {
      // Directory doesn't exist, proceed with creation
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    // Create workspace directory
    await mkdir(workspacePath, { recursive: true });

    const workspace: Workspace = {
      name,
      path: workspacePath,
    };

    if (switchTo) {
      await this.switchWorkspace(name);
    }

    return workspace;
  }

  async switchWorkspace(name: string): Promise<Workspace> {
    this.validateWorkspaceName(name);

    const workspacePath = path.join(this.rootDirectory, name);

    // Verify workspace directory exists
    try {
      const stats = await stat(workspacePath);
      if (!stats.isDirectory()) {
        throw new Error(`"${name}" exists but is not a directory`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Workspace "${name}" does not exist`);
      }
      throw error;
    }

    const previousWorkspaceName = this.currentWorkspaceName;

    // Save the new workspace to persistent state
    await this.persistence.saveState(name);

    this.currentWorkspaceName = name;
    const workspace: Workspace = {
      name,
      path: workspacePath,
    };

    // Emit event only if workspace actually changed
    if (previousWorkspaceName !== name) {
      this.emit("switched", workspace);
    }

    return workspace;
  }

  getCurrentWorkspace(): Workspace {
    return {
      name: this.currentWorkspaceName,
      path: path.join(this.rootDirectory, this.currentWorkspaceName),
    };
  }

  getCurrentWorkspaceDirectory(): string {
    return this.getCurrentWorkspace().path;
  }

  async listWorkspaces(): Promise<Workspace[]> {
    try {
      const entries = await readdir(this.rootDirectory, {
        withFileTypes: true,
      });
      const workspaces: Workspace[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          workspaces.push({
            name: entry.name,
            path: path.join(this.rootDirectory, entry.name),
          });
        }
      }

      return workspaces;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async hasWorkspace(name: string): Promise<boolean> {
    try {
      const workspacePath = path.join(this.rootDirectory, name);
      const stats = await stat(workspacePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
