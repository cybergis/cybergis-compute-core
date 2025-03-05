export interface BaseFolder {
  type: "globus" | "git" | "local" | "empty";
}

export interface GlobusFolder extends BaseFolder {
  type: "globus";
  endpoint: string;
  path: string;
}

export interface GitFolder extends BaseFolder {
  type: "git";
  gitId: string;
}

export interface LocalFolder extends BaseFolder {
  type: "local";
  localPath: string;
}

export interface EmptyFolder {
  type: "empty"
}

export type NeedUploadFolder = GlobusFolder | GitFolder | LocalFolder;