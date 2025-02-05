export class FileFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileFormatError";
  }
}

export class FileStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileStructureError";
  }
}

export class FileNotExistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileNotExistError";
  }
}

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

export class ConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorError";
  }
}
