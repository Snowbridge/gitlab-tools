import yargs from 'yargs'
import { GitRemoteListCliHandler } from '../../../../services/GitCliHandlers/GitRemoteCliHandler'
import {
    checkWorkspaceCopySelectionArgs,
    extractErrorDetail,
    relPath,
    resolveCopiesFromArgv,
} from './_shared'

export const command = 'list'

export const describe = 'Список remotes в рабочих копиях'

const DETAILED_DESCRIPTION = [
    'Выполняет `git remote` (опционально `-v`) в каждой выбранной рабочей копии.',
    'Вывод: `✔ <копия>:` и строки stdout git с отступом.',
].join('\n')

export function checkListArgs(argv: Record<string, unknown>): boolean {
    checkWorkspaceCopySelectionArgs(argv as Parameters<typeof checkWorkspaceCopySelectionArgs>[0])
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace remote list\n\n${DETAILED_DESCRIPTION}`)
        .options({
            verbose: { type: 'boolean', alias: 'v', desc: 'git remote -v' },
        })
        .check((argv) => checkListArgs(argv as Record<string, unknown>))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: Record<string, unknown>): Promise<void> => {
    const verbose = !!((argv.verbose ?? argv.v) as boolean)

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
            try {
                const output = await new GitRemoteListCliHandler(abs, { verbose }).executeWithOutput()
                console.log(`✔ ${rel}:`)
                if (output) {
                    for (const line of output.split('\n'))
                        console.log(`  ${line}`)
                }
            } catch (e: unknown) {
                console.error(`✖ ${rel}: ${extractErrorDetail(e)}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось получить список remote в ${failed} из ${copies.length} рабочих копий`)
            process.exitCode = 1
        }
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : String(e))
        process.exitCode = 1
    }
}
