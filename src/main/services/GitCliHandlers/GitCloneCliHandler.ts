import { AbstractGitCliHandler } from "./AbstractGitCliHandler";

export class GitCloneCliHandler extends AbstractGitCliHandler {

    private remotePath: string

    constructor(remotePath: string, localPath: string, flags: string) {
        super(localPath, flags)
        this.remotePath = remotePath
        this.localPath = localPath
    }

    getCommand(): string {
        return `git clone ${this.flags} ${this.remotePath} ${this.localPath}`
    }
}