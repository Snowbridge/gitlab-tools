import { AbstractGitCliHandlerWithCwd } from './GitRemoteCliHandler'

export interface GitSwitchOptions {
    branch?: string
    create?: string
    forceCreate?: string
    force?: boolean
    merge?: boolean
    discardChanges?: boolean
    track?: boolean
    noTrack?: boolean
    guess?: boolean
    noGuess?: boolean
    quiet?: boolean
    progress?: boolean
    noProgress?: boolean
    recurseSubmodules?: boolean
    noRecurseSubmodules?: boolean
    ignoreOtherWorktrees?: boolean
}

export function quoteArg(arg: string): string {
    if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(arg))
        return arg
    return `"${arg.replace(/(["\\$`!])/g, '\\$1')}"`
}

export class GitSwitchCliHandler extends AbstractGitCliHandlerWithCwd {
    private options: GitSwitchOptions

    constructor(localPath: string, options: GitSwitchOptions) {
        super(localPath)
        this.options = options
    }

    getCommand(): string {
        const parts: string[] = ['git switch']
        const o = this.options
        if (o.create)
            parts.push(`-c ${quoteArg(o.create)}`)
        if (o.forceCreate)
            parts.push(`-C ${quoteArg(o.forceCreate)}`)
        if (o.force)
            parts.push('--force')
        if (o.merge)
            parts.push('--merge')
        if (o.discardChanges)
            parts.push('--discard-changes')
        if (o.track)
            parts.push('--track')
        if (o.noTrack)
            parts.push('--no-track')
        if (o.guess)
            parts.push('--guess')
        if (o.noGuess)
            parts.push('--no-guess')
        if (o.quiet)
            parts.push('--quiet')
        if (o.progress)
            parts.push('--progress')
        if (o.noProgress)
            parts.push('--no-progress')
        if (o.recurseSubmodules)
            parts.push('--recurse-submodules')
        if (o.noRecurseSubmodules)
            parts.push('--no-recurse-submodules')
        if (o.ignoreOtherWorktrees)
            parts.push('--ignore-other-worktrees')
        if (o.branch)
            parts.push(quoteArg(o.branch))
        return parts.join(' ')
    }
}
