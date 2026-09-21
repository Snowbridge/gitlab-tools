import { exec } from 'node:child_process'
import { ExecException } from 'child_process'
import { AbstractGitCliHandlerWithCwd } from './GitRemoteCliHandler'

export interface GitStatusOptions {
    short?: boolean
    branch?: boolean
    /** true/'' — bare --porcelain (v1 по умолчанию git); 'v1'/'v2' — --porcelain=<version> */
    porcelain?: boolean | string
    showStash?: boolean
    /** true/'' — bare --untracked-files; 'no'/'normal'/'all' — --untracked-files=<mode> */
    untrackedFiles?: boolean | string
    /** true/'' — bare --ignored; 'traditional'/'matching'/'no' — --ignored=<mode> */
    ignored?: boolean | string
    verbose?: boolean
}

function optionalValueFlag(base: string, value: boolean | string | undefined): string | null {
    if (value === undefined || value === false)
        return null
    if (value === true || value === '')
        return base
    return `${base}=${value}`
}

export class GitStatusCliHandler extends AbstractGitCliHandlerWithCwd {
    private options: GitStatusOptions

    constructor(localPath: string, options: GitStatusOptions) {
        super(localPath)
        this.options = options
    }

    getCommand(): string {
        const parts: string[] = ['git status']
        const o = this.options
        if (o.short)
            parts.push('--short')
        if (o.branch)
            parts.push('--branch')
        const porcelain = optionalValueFlag('--porcelain', o.porcelain)
        if (porcelain)
            parts.push(porcelain)
        if (o.showStash)
            parts.push('--show-stash')
        const untracked = optionalValueFlag('--untracked-files', o.untrackedFiles)
        if (untracked)
            parts.push(untracked)
        const ignored = optionalValueFlag('--ignored', o.ignored)
        if (ignored)
            parts.push(ignored)
        if (o.verbose)
            parts.push('--verbose')
        return parts.join(' ')
    }

    /** Выполняет git status в каталоге копии и возвращает stdout (без завершающего перевода строки). */
    executeWithOutput(): Promise<string> {
        return new Promise<string>((resolve, reject): void => {
            exec(
                this.getCommand(),
                { cwd: this.localPath },
                (error: ExecException | null, stdout: string, stderr: string) => {
                    if (error)
                        return reject({ error, stdout, stderr })
                    resolve(stdout.replace(/\s+$/, ''))
                }
            )
        })
    }
}
