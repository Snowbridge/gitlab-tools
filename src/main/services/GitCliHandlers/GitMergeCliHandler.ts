import { exec } from 'node:child_process'
import { AbstractGitCliHandlerWithCwd } from './GitRemoteCliHandler'
import { quoteArg } from './GitSwitchCliHandler'

export interface GitMergeOptions {
    from: string
    noFf?: boolean
    ffOnly?: boolean
    squash?: boolean
    message?: string
    strategyOption?: string[]
}

export class GitMergeCliHandler extends AbstractGitCliHandlerWithCwd {
    private options: GitMergeOptions

    constructor(localPath: string, options: GitMergeOptions) {
        super(localPath)
        this.options = options
    }

    getCommand(): string {
        const parts: string[] = ['git merge']
        const o = this.options
        if (o.noFf)
            parts.push('--no-ff')
        if (o.ffOnly)
            parts.push('--ff-only')
        if (o.squash)
            parts.push('--squash')
        if (o.message !== undefined && o.message !== '')
            parts.push(`-m ${quoteArg(o.message)}`)
        for (const opt of o.strategyOption ?? []) {
            parts.push(`-X ${quoteArg(opt)}`)
        }
        parts.push(quoteArg(o.from))
        return parts.join(' ')
    }
}

export function getGlobalDefaultBranch(): Promise<string> {
    return new Promise<string>((resolve) => {
        exec('git config --global init.defaultBranch', (error, stdout) => {
            if (error) {
                resolve('master')
                return
            }
            const branch = stdout.trim()
            resolve(branch === '' ? 'master' : branch)
        })
    })
}

export function hasLocalBranch(abs: string, branch: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        exec('git show-ref', { cwd: abs }, (error, stdout) => {
            if (error) {
                resolve(false)
                return
            }
            const headsRef = `refs/heads/${branch}`
            for (const line of stdout.split('\n')) {
                const trimmed = line.trim()
                if (!trimmed)
                    continue
                const tokens = trimmed.split(/\s+/)
                if (tokens.length < 2)
                    continue
                if (tokens[1] === headsRef) {
                    resolve(true)
                    return
                }
            }
            resolve(false)
        })
    })
}

export function hasBranch(abs: string, from: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        exec('git show-ref', { cwd: abs }, (error, stdout) => {
            if (error) {
                resolve(false)
                return
            }
            const headsRef = `refs/heads/${from}`
            const remoteSuffix = `/${from}`
            for (const line of stdout.split('\n')) {
                const trimmed = line.trim()
                if (!trimmed)
                    continue
                const tokens = trimmed.split(/\s+/)
                if (tokens.length < 2)
                    continue
                const ref = tokens[1]
                if (ref === headsRef) {
                    resolve(true)
                    return
                }
                if (ref.startsWith('refs/remotes/') && ref.endsWith(remoteSuffix)) {
                    resolve(true)
                    return
                }
            }
            resolve(false)
        })
    })
}
