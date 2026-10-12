import yargs from 'yargs'
import { GitRemotePruneCliHandler } from '../../../../services/GitCliHandlers/GitRemoteCliHandler'
import {
    checkWorkspaceCopySelectionArgs,
    extractErrorDetail,
    relPath,
    resolveCopiesFromArgv,
    skipIfRemoteMissing,
} from './_shared'

export const command = 'prune <name>'

export const describe = 'Prune stale remote-tracking ветки'

const DETAILED_DESCRIPTION = [
    'Выполняет `git remote prune` в каждой выбранной рабочей копии.',
    'Если remote отсутствует — пропуск с сообщением.',
].join('\n')

export function checkPruneArgs(argv: Record<string, unknown>): boolean {
    checkWorkspaceCopySelectionArgs(argv as Parameters<typeof checkWorkspaceCopySelectionArgs>[0])
    if (!argv.name)
        throw new Error('Укажите имя remote: `workspace remote prune <name>`')
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace remote prune <name>\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', { type: 'string', demandOption: true, desc: 'Имя remote' })
        .options({
            'dry-run': { type: 'boolean', alias: 'n', desc: 'git remote prune -n / --dry-run' },
        })
        .check((argv) => checkPruneArgs(argv as Record<string, unknown>))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: Record<string, unknown>): Promise<void> => {
    const name = String(argv.name)
    const dryRun = !!((argv['dry-run'] ?? argv.dryRun ?? argv.n) as boolean)

    try {
        const { copies, resolvedDir } = await resolveCopiesFromArgv({
            dir: String(argv.dir ?? '.'),
            all: !!argv.all,
            interactive: !!argv.interactive,
            repos: (argv.repos as string[]) ?? [],
        })
        let failed = 0
        for (const abs of copies) {
            const rel = relPath(resolvedDir, abs)
            if (await skipIfRemoteMissing(abs, rel, name))
                continue
            try {
                await new GitRemotePruneCliHandler(abs, name, { dryRun }).execute()
                console.log(`✔ ${rel}`)
            } catch (e: unknown) {
                console.error(`✖ ${rel}: ${extractErrorDetail(e)}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось выполнить prune в ${failed} из ${copies.length} рабочих копий`)
            process.exitCode = 1
        }
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : String(e))
        process.exitCode = 1
    }
}
