import { AbstractGitCliHandlerWithCwd } from './GitRemoteCliHandler'

export class GitPushAllCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string

    constructor(localPath: string, remoteName: string) {
        super(localPath)
        this.remoteName = remoteName
    }

    getCommand(): string {
        return `git push --all ${this.remoteName} && git push --tags ${this.remoteName}`
    }
}
