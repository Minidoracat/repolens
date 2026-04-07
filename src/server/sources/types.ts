export interface FileNode {
  name: string;
  path: string; // relative path from project root
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
  language?: string;
}

export interface ProjectSource {
  /** Display name for the project */
  name: string;
  /** Absolute path to the project files on disk */
  localPath: string;
  /** Default branch (for GitHub sources) */
  defaultBranch?: string;
  /** Source URL (for GitHub sources) */
  sourceUrl?: string;
}
