import yargs from 'yargs'
import { GitRemoteRenameCliHandler } from '../../../../services/GitCliHandlers/GitRemoteCliHandler'
import {
    checkWorkspaceCopySelectionArgs,
    extractErrorDetail,
    relPath,
    resolveCopiesFromArgv,
    skipIfRemoteMissing,
} from './_shared'

export const command = 'rename <old> <new>'

export const describe = 'Переименовать remote в рабочих копиях'

const DETAILED_DESCRIPTION = [
    'Выполняет `git remote rename` в каждой выбранной рабочей копии.',
    'Если исходный remote отсутствует в копии — пропуск с сообщением.',
].join('\n')

export function checkRenameArgs(argv: Record<string, unknown>): boolean {
    checkWorkspaceCopySelectionArgs(argv as Parameters<typeof checkWorkspaceCopySelectionArgs>[0])
    if (!argv.old)
        throw new Error('Укажите старое имя: `workspace remote rename <old> <new>`')
    if (!argv.new)
        throw new Error('Укажите новое имя: `workspace remote rename <old> <new>`')
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace remote rename <old> <new>\n\n${DETAILED_DESCRIPTION}`)
        .positional('old', { type: 'string', demandOption: true, desc: 'Текущее имя remote' })
        .positional('new', { type: 'string', demandOption: true, desc: 'Новое имя remote' })
        .check((argv) => checkRenameArgs(argv as Record<string, unknown>))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: Record<string, unknown>): Promise<void> => {
    const oldName = String(argv.old)
    const newName = String(argv.new)

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
            if (await skipIfRemoteMissing(abs, rel, oldName))
                continue
            try {
                await new GitRemoteRenameCliHandler(abs, oldName, newName).execute()
                console.log(`✔ ${rel}`)
            } catch (e: unknown) {
                console.error(`✖ ${rel}: ${extractErrorDetail(e)}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось переименовать remote в ${failed} из ${copies.length} рабочих копий`)
            process.exitCode = 1
        }
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : String(e))
        process.exitCode = 1
    }
}
