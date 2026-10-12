import yargs from 'yargs'
import {
    GitRemoteSetHeadCliHandler,
    GitRemoteSetHeadOptions,
} from '../../../../services/GitCliHandlers/GitRemoteCliHandler'
import {
    checkWorkspaceCopySelectionArgs,
    extractErrorDetail,
    relPath,
    resolveCopiesFromArgv,
    skipIfRemoteMissing,
} from './_shared'

export const command = 'set-head <name> [branch]'

export const describe = 'Установить refs/remotes/<name>/HEAD'

const DETAILED_DESCRIPTION = [
    'Выполняет `git remote set-head` в каждой выбранной рабочей копии.',
    'Режим: --auto, --delete (без коротких -a/-d) или явная ветка [branch].',
    'Укажите ровно один режим.',
].join('\n')

export function argvToSetHeadOptions(argv: Record<string, unknown>): GitRemoteSetHeadOptions {
    return {
        auto: !!argv.auto,
        noAuto: !!((argv['no-auto'] ?? argv.noAuto) as boolean),
        delete: !!argv.delete,
        noDelete: !!((argv['no-delete'] ?? argv.noDelete) as boolean),
        branch: argv.branch as string | undefined,
    }
}

export function checkSetHeadArgs(argv: Record<string, unknown>): boolean {
    checkWorkspaceCopySelectionArgs(argv as Parameters<typeof checkWorkspaceCopySelectionArgs>[0])
    if (!argv.name)
        throw new Error('Укажите имя remote: `workspace remote set-head <name> [branch]`')
    const modes = [
        argv.auto,
        argv['no-auto'] ?? argv.noAuto,
        argv.delete,
        argv['no-delete'] ?? argv.noDelete,
        argv.branch,
    ].filter(Boolean)
    if (modes.length !== 1) {
        throw new Error(
            'Укажите ровно один режим: --auto, --no-auto, --delete, --no-delete или ветку [branch]'
        )
    }
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace remote set-head <name> [branch]\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', { type: 'string', demandOption: true, desc: 'Имя remote' })
        .positional('branch', { type: 'string', desc: 'Ветка для HEAD (вместо --auto/--delete)' })
        .options({
            auto: { type: 'boolean', desc: 'git remote set-head --auto (без алиаса -a)' },
            'no-auto': { type: 'boolean', desc: 'git remote set-head --no-auto' },
            delete: { type: 'boolean', desc: 'git remote set-head --delete (без алиаса -d)' },
            'no-delete': { type: 'boolean', desc: 'git remote set-head --no-delete' },
        })
        .check((argv) => checkSetHeadArgs(argv as Record<string, unknown>))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: Record<string, unknown>): Promise<void> => {
    const name = String(argv.name)
    const options = argvToSetHeadOptions(argv)

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
                await new GitRemoteSetHeadCliHandler(abs, name, options).execute()
                console.log(`✔ ${rel}`)
            } catch (e: unknown) {
                console.error(`✖ ${rel}: ${extractErrorDetail(e)}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось set-head в ${failed} из ${copies.length} рабочих копий`)
            process.exitCode = 1
        }
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : String(e))
        process.exitCode = 1
    }
}
