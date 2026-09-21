import { AbstractGitCliHandlerWithCwd } from './GitRemoteCliHandler'
import { quoteArg } from './GitSwitchCliHandler'

export interface GitFetchOptions {
    remote?: string
    refspecs?: string[]
    quiet?: boolean
    verbose?: boolean
    progress?: boolean
    noProgress?: boolean
    fetchAll?: boolean
    prune?: boolean
    pruneTags?: boolean
    force?: boolean
    tags?: boolean
    noTags?: boolean
    jobs?: number
    depth?: number
    deepen?: number
    shallowSince?: string
    shallowExclude?: string[]
    unshallow?: boolean
    updateShallow?: boolean
    append?: boolean
    dryRun?: boolean
    recurseSubmodules?: boolean
    noRecurseSubmodules?: boolean
}

export class GitFetchCliHandler extends AbstractGitCliHandlerWithCwd {
    private options: GitFetchOptions

    constructor(localPath: string, options: GitFetchOptions = {}) {
        super(localPath)
        this.options = options
    }

    getCommand(): string {
        const parts: string[] = ['git fetch']
        const o = this.options
        if (o.quiet)
            parts.push('--quiet')
        if (o.verbose)
            parts.push('--verbose')
        if (o.progress)
            parts.push('--progress')
        if (o.noProgress)
            parts.push('--no-progress')
        if (o.fetchAll)
            parts.push('--all')
        if (o.prune)
            parts.push('--prune')
        if (o.pruneTags)
            parts.push('--prune-tags')
        if (o.force)
            parts.push('--force')
        if (o.tags)
            parts.push('--tags')
        if (o.noTags)
            parts.push('--no-tags')
        if (o.jobs !== undefined)
            parts.push(`--jobs ${o.jobs}`)
        if (o.depth !== undefined)
            parts.push(`--depth ${o.depth}`)
        if (o.deepen !== undefined)
            parts.push(`--deepen ${o.deepen}`)
        if (o.shallowSince !== undefined && o.shallowSince !== '')
            parts.push(`--shallow-since ${quoteArg(o.shallowSince)}`)
        for (const exclude of o.shallowExclude ?? []) {
            parts.push(`--shallow-exclude ${quoteArg(exclude)}`)
        }
        if (o.unshallow)
            parts.push('--unshallow')
        if (o.updateShallow)
            parts.push('--update-shallow')
        if (o.append)
            parts.push('--append')
        if (o.dryRun)
            parts.push('--dry-run')
        if (o.recurseSubmodules)
            parts.push('--recurse-submodules')
        if (o.noRecurseSubmodules)
            parts.push('--no-recurse-submodules')
        if (o.remote)
            parts.push(quoteArg(o.remote))
        for (const refspec of o.refspecs ?? []) {
            parts.push(quoteArg(refspec))
        }
        return parts.join(' ')
    }
}
