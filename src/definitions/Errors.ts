export class FileFormatError extends Error {
  /**
   *
   * @param message error message
   */
  public constructor(message: string) {
    super(message);
    this.name = "FileFormatError";
  }
}

export class FileStructureError extends Error {
  /**
   *
   * @param message error message
   */
  public constructor(message: string) {
    super(message);
    this.name = "FileStructureError";
  }
}

export class FileNotExistError extends Error {
  /**
   *
   * @param message error message
   */
  public constructor(message: string) {
    super(message);
    this.name = "FileNotExistError";
  }
}

export class NotImplementedError extends Error {
  /**
   *
   * @param message error message
   */
  public constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

export class ConnectorError extends Error {
  /**
   *
   * @param message error message
   */
  public constructor(message: string) {
    super(message);
    this.name = "ConnectorError";
  }
}
