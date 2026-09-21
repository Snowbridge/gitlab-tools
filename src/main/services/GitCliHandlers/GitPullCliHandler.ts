import { AbstractGitCliHandlerWithCwd } from './GitRemoteCliHandler'
import { quoteArg } from './GitSwitchCliHandler'

export interface GitPullOptions {
    remote?: string
    branches?: string[]
    quiet?: boolean
    verbose?: boolean
    progress?: boolean
    noProgress?: boolean
    rebase?: boolean
    noRebase?: boolean
    ffOnly?: boolean
    autostash?: boolean
    noAutostash?: boolean
    pullAll?: boolean
    prune?: boolean
    force?: boolean
    tags?: boolean
    noTags?: boolean
    allowUnrelatedHistories?: boolean
    noCommit?: boolean
    commit?: boolean
    squash?: boolean
    noEdit?: boolean
    edit?: boolean
    strategy?: string
    strategyOption?: string[]
    jobs?: number
    recurseSubmodules?: boolean
    noRecurseSubmodules?: boolean
}

export class GitPullCliHandler extends AbstractGitCliHandlerWithCwd {
    private options: GitPullOptions

    constructor(localPath: string, options: GitPullOptions = {}) {
        super(localPath)
        this.options = options
    }

    getCommand(): string {
        const parts: string[] = ['git pull']
        const o = this.options
        if (o.quiet)
            parts.push('--quiet')
        if (o.verbose)
            parts.push('--verbose')
        if (o.progress)
            parts.push('--progress')
        if (o.noProgress)
            parts.push('--no-progress')
        if (o.rebase)
            parts.push('--rebase')
        if (o.noRebase)
            parts.push('--no-rebase')
        if (o.ffOnly)
            parts.push('--ff-only')
        if (o.autostash)
            parts.push('--autostash')
        if (o.noAutostash)
            parts.push('--no-autostash')
        if (o.pullAll)
            parts.push('--all')
        if (o.prune)
            parts.push('--prune')
        if (o.force)
            parts.push('--force')
        if (o.tags)
            parts.push('--tags')
        if (o.noTags)
            parts.push('--no-tags')
        if (o.allowUnrelatedHistories)
            parts.push('--allow-unrelated-histories')
        if (o.noCommit)
            parts.push('--no-commit')
        if (o.commit)
            parts.push('--commit')
        if (o.squash)
            parts.push('--squash')
        if (o.noEdit)
            parts.push('--no-edit')
        if (o.edit)
            parts.push('--edit')
        if (o.strategy !== undefined && o.strategy !== '')
            parts.push(`--strategy ${quoteArg(o.strategy)}`)
        for (const opt of o.strategyOption ?? []) {
            parts.push(`-X ${quoteArg(opt)}`)
        }
        if (o.jobs !== undefined)
            parts.push(`--jobs ${o.jobs}`)
        if (o.recurseSubmodules)
            parts.push('--recurse-submodules')
        if (o.noRecurseSubmodules)
            parts.push('--no-recurse-submodules')
        if (o.remote)
            parts.push(quoteArg(o.remote))
        for (const branch of o.branches ?? []) {
            parts.push(quoteArg(branch))
        }
        return parts.join(' ')
    }
}
