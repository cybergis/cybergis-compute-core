export class FileFormatError extends Error {
    constructor(message) {
        super(message)
        this.name = "FileFormatError"
    }
}

export class FileStructureError extends Error {
    constructor(message) {
        super(message)
        this.name = "FileStructureError"
    }
}
