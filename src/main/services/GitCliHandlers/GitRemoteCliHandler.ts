import { exec } from 'node:child_process'
import { ExecException } from 'child_process'

export abstract class AbstractGitCliHandlerWithCwd {
    protected localPath: string

    constructor(localPath: string) {
        this.localPath = localPath
    }

    async execute(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject): void => {
            exec(
                this.getCommand(),
                { cwd: this.localPath },
                (error: ExecException | null, stdout: string, stderr: string) => {
                    if (error)
                        return reject({ error: error, stdout: stdout, stderr: stderr })

                    resolve(true)
                }
            )
        })
    }

    abstract getCommand(): string
}

export class GitRemoteGetUrlCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string

    constructor(localPath: string, remoteName: string) {
        super(localPath)
        this.remoteName = remoteName
    }

    getCommand(): string {
        return `git remote get-url ${this.remoteName}`
    }
}

export class GitRemoteAddCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string
    private url: string

    constructor(localPath: string, remoteName: string, url: string) {
        super(localPath)
        this.remoteName = remoteName
        this.url = url
    }

    getCommand(): string {
        return `git remote add ${this.remoteName} ${this.url}`
    }
}

export class GitRemoteRemoveCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string

    constructor(localPath: string, remoteName: string) {
        super(localPath)
        this.remoteName = remoteName
    }

    getCommand(): string {
        return `git remote remove ${this.remoteName}`
    }
}

export class GitRemoteRenameCliHandler extends AbstractGitCliHandlerWithCwd {
    private from: string
    private to: string

    constructor(localPath: string, from: string, to: string) {
        super(localPath)
        this.from = from
        this.to = to
    }

    getCommand(): string {
        return `git remote rename ${this.from} ${this.to}`
    }
}
