export class ProcessingSkippedError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ProcessingSkippedError'
    }
}
