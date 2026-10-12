import yargs from 'yargs'
import { GitRemoteRemoveCliHandler } from '../../../../services/GitCliHandlers/GitRemoteCliHandler'
import {
    checkWorkspaceCopySelectionArgs,
    extractErrorDetail,
    relPath,
    resolveCopiesFromArgv,
    skipIfRemoteMissing,
} from './_shared'

export const command = 'remove <name>'

export const describe = 'Удалить remote в рабочих копиях'

const DETAILED_DESCRIPTION = [
    'Выполняет `git remote remove` в каждой выбранной рабочей копии.',
    'Если remote отсутствует в копии — пропуск с сообщением (не ошибка).',
].join('\n')

export function checkRemoveArgs(argv: Record<string, unknown>): boolean {
    checkWorkspaceCopySelectionArgs(argv as Parameters<typeof checkWorkspaceCopySelectionArgs>[0])
    if (!argv.name)
        throw new Error('Укажите имя remote: `workspace remote remove <name>`')
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace remote remove <name>\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', { type: 'string', demandOption: true, desc: 'Имя remote' })
        .check((argv) => checkRemoveArgs(argv as Record<string, unknown>))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: Record<string, unknown>): Promise<void> => {
    const name = String(argv.name)

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
                await new GitRemoteRemoveCliHandler(abs, name).execute()
                console.log(`✔ ${rel}`)
            } catch (e: unknown) {
                console.error(`✖ ${rel}: ${extractErrorDetail(e)}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось удалить remote в ${failed} из ${copies.length} рабочих копий`)
            process.exitCode = 1
        }
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : String(e))
        process.exitCode = 1
    }
}
