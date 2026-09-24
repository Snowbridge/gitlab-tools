import { AbstractGitCliHandlerWithCwd } from './GitRemoteCliHandler'
import { quoteArg } from './GitSwitchCliHandler'

export interface GitBranchDeleteOptions {
    branch: string
    force?: boolean
}

export class GitBranchDeleteCliHandler extends AbstractGitCliHandlerWithCwd {
    private options: GitBranchDeleteOptions

    constructor(localPath: string, options: GitBranchDeleteOptions) {
        super(localPath)
        this.options = options
    }

    getCommand(): string {
        const flag = this.options.force ? '-D' : '-d'
        return `git branch ${flag} ${quoteArg(this.options.branch)}`
    }
}
