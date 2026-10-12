import * as path from 'path'
import { resolveWorkspaceCopies } from '../../../../services/Workspace'
import { ProcessGitRemoteExecutor } from '../../../../services/ProcessGitRemoteExecutor'

export function checkWorkspaceCopySelectionArgs(argv: {
    repos?: string[]
    all?: boolean
    interactive?: boolean
}): boolean {
    const repos = (argv.repos as string[]) ?? []
    const all = !!argv.all
    const interactive = !!argv.interactive
    if (all && interactive)
        throw new Error('Опции --interactive и --all не могут использоваться вместе')
    if (repos.length > 0 && (all || interactive)) {
        throw new Error('Нельзя указывать рабочие копии вместе с --all или --interactive')
    }
    if (repos.length === 0 && !all && !interactive) {
        throw new Error(
            'Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive'
        )
    }
    return true
}

export function extractErrorDetail(e: unknown): string {
    if (e && typeof e === 'object') {
        const anyErr = e as { stderr?: string; error?: Error; message?: string }
        const stderr = typeof anyErr.stderr === 'string' ? anyErr.stderr.trim() : ''
        if (stderr)
            return stderr
        if (anyErr.error instanceof Error && anyErr.error.message)
            return anyErr.error.message
        if (typeof anyErr.message === 'string' && anyErr.message)
            return anyErr.message
    }
    if (e instanceof Error)
        return e.message
    return String(e)
}

const defaultExecutor = new ProcessGitRemoteExecutor()

export async function skipIfRemoteMissing(
    abs: string,
    rel: string,
    remoteName: string,
    executor: ProcessGitRemoteExecutor = defaultExecutor
): Promise<boolean> {
    const exists = await executor.remoteExists(abs, remoteName)
    if (!exists) {
        console.log(`− ${rel}: remote «${remoteName}» отсутствует`)
        return true
    }
    return false
}

export interface RunForEachCopyOptions {
    dir: string
    all: boolean
    interactive: boolean
    repos: string[]
}

export async function resolveCopiesFromArgv(argv: RunForEachCopyOptions): Promise<{
    copies: string[]
    resolvedDir: string
}> {
    const copies = await resolveWorkspaceCopies({
        dir: argv.dir,
        all: argv.all,
        interactive: argv.interactive,
        repos: argv.repos,
    })
    const resolvedDir = path.resolve(argv.dir)
    return { copies, resolvedDir }
}

export function relPath(resolvedDir: string, abs: string): string {
    return path.relative(resolvedDir, abs) || '.'
}
