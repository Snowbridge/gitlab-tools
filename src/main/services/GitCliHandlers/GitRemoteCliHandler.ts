import { exec } from 'node:child_process'
import { ExecException } from 'child_process'
import { quoteArg } from './quoteArg'

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

function execWithOutput(localPath: string, command: string): Promise<string> {
    return new Promise<string>((resolve, reject): void => {
        exec(
            command,
            { cwd: localPath },
            (error: ExecException | null, stdout: string, stderr: string) => {
                if (error)
                    return reject({ error, stdout, stderr })
                resolve(stdout.replace(/\s+$/, ''))
            }
        )
    })
}

export interface GitRemoteAddOptions {
    fetch?: boolean
    tags?: boolean
    noTags?: boolean
    track?: string[]
    master?: string
    mirror?: boolean | 'push' | 'fetch'
}

export class GitRemoteGetUrlCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string
    private push: boolean
    private all: boolean

    constructor(localPath: string, remoteName: string, options: { push?: boolean; all?: boolean } = {}) {
        super(localPath)
        this.remoteName = remoteName
        this.push = !!options.push
        this.all = !!options.all
    }

    getCommand(): string {
        const parts = ['git remote get-url']
        if (this.push)
            parts.push('--push')
        if (this.all)
            parts.push('--all')
        parts.push(quoteArg(this.remoteName))
        return parts.join(' ')
    }

    executeWithOutput(): Promise<string> {
        return execWithOutput(this.localPath, this.getCommand())
    }
}

export class GitRemoteAddCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string
    private url: string
    private options: GitRemoteAddOptions

    constructor(
        localPath: string,
        remoteName: string,
        url: string,
        options: GitRemoteAddOptions = {}
    ) {
        super(localPath)
        this.remoteName = remoteName
        this.url = url
        this.options = options
    }

    getCommand(): string {
        const parts = ['git remote add']
        const o = this.options
        if (o.fetch)
            parts.push('--fetch')
        if (o.tags)
            parts.push('--tags')
        if (o.noTags)
            parts.push('--no-tags')
        if (o.track) {
            for (const b of o.track)
                parts.push('-t', quoteArg(b))
        }
        if (o.master)
            parts.push('-m', quoteArg(o.master))
        if (o.mirror === true)
            parts.push('--mirror')
        else if (o.mirror === 'push' || o.mirror === 'fetch')
            parts.push(`--mirror=${o.mirror}`)
        parts.push(quoteArg(this.remoteName), quoteArg(this.url))
        return parts.join(' ')
    }
}

export class GitRemoteRemoveCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string

    constructor(localPath: string, remoteName: string) {
        super(localPath)
        this.remoteName = remoteName
    }

    getCommand(): string {
        return `git remote remove ${quoteArg(this.remoteName)}`
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
        return `git remote rename ${quoteArg(this.from)} ${quoteArg(this.to)}`
    }
}

export interface GitRemoteListOptions {
    verbose?: boolean
}

export class GitRemoteListCliHandler extends AbstractGitCliHandlerWithCwd {
    private options: GitRemoteListOptions

    constructor(localPath: string, options: GitRemoteListOptions = {}) {
        super(localPath)
        this.options = options
    }

    getCommand(): string {
        const parts = ['git remote']
        if (this.options.verbose)
            parts.push('-v')
        return parts.join(' ')
    }

    executeWithOutput(): Promise<string> {
        return execWithOutput(this.localPath, this.getCommand())
    }
}

export interface GitRemotePruneOptions {
    dryRun?: boolean
}

export class GitRemotePruneCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string
    private options: GitRemotePruneOptions

    constructor(localPath: string, remoteName: string, options: GitRemotePruneOptions = {}) {
        super(localPath)
        this.remoteName = remoteName
        this.options = options
    }

    getCommand(): string {
        const parts = ['git remote prune']
        if (this.options.dryRun)
            parts.push('-n')
        parts.push(quoteArg(this.remoteName))
        return parts.join(' ')
    }
}

export interface GitRemoteSetHeadOptions {
    auto?: boolean
    noAuto?: boolean
    delete?: boolean
    noDelete?: boolean
    branch?: string
}

export class GitRemoteSetHeadCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string
    private options: GitRemoteSetHeadOptions

    constructor(localPath: string, remoteName: string, options: GitRemoteSetHeadOptions = {}) {
        super(localPath)
        this.remoteName = remoteName
        this.options = options
    }

    getCommand(): string {
        const parts = ['git remote set-head', quoteArg(this.remoteName)]
        const o = this.options
        if (o.auto)
            parts.push('--auto')
        if (o.noAuto)
            parts.push('--no-auto')
        if (o.delete)
            parts.push('--delete')
        if (o.noDelete)
            parts.push('--no-delete')
        if (o.branch)
            parts.push(quoteArg(o.branch))
        return parts.join(' ')
    }
}

export interface GitRemoteSetBranchesOptions {
    add?: boolean
    noAdd?: boolean
    delete?: boolean
    noDelete?: boolean
    branches: string[]
}

export class GitRemoteSetBranchesCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string
    private options: GitRemoteSetBranchesOptions

    constructor(localPath: string, remoteName: string, options: GitRemoteSetBranchesOptions) {
        super(localPath)
        this.remoteName = remoteName
        this.options = options
    }

    getCommand(): string {
        const parts = ['git remote set-branches']
        const o = this.options
        if (o.add)
            parts.push('--add')
        if (o.noAdd)
            parts.push('--no-add')
        if (o.delete)
            parts.push('--delete')
        if (o.noDelete)
            parts.push('--no-delete')
        parts.push(quoteArg(this.remoteName))
        for (const b of o.branches)
            parts.push(quoteArg(b))
        return parts.join(' ')
    }
}
