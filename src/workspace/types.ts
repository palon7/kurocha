export interface Workspace {
  name: string;
  path: string;
}

export interface WorkspaceConfig {
  rootDirectory: string;
}
export interface WorkspaceInitializeResult {
  warnings: WorkspaceInitWarning[];
}

export type WorkspaceInitWarning =
  | {
      type: "not_found";
      savedName: string;
      fallbackName: string;
    }
  | { type: "invalid_name"; savedName: string; fallbackName: string };
