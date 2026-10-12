import yargs from 'yargs'
import { GitRemoteGetUrlCliHandler } from '../../../../services/GitCliHandlers/GitRemoteCliHandler'
import {
    checkWorkspaceCopySelectionArgs,
    extractErrorDetail,
    relPath,
    resolveCopiesFromArgv,
    skipIfRemoteMissing,
} from './_shared'

export const command = 'get-url <name>'

export const describe = 'Получить URL remote в рабочих копиях'

const DETAILED_DESCRIPTION = [
    'Выполняет `git remote get-url` в каждой выбранной рабочей копии.',
    'Вывод: `✔ <копия>: <url>`; при --all несколько URL — по одному на строку с тем же префиксом.',
    'Опция --all (все URL) не путать с --all workspace (выбор копий).',
].join('\n')

export function checkGetUrlArgs(argv: Record<string, unknown>): boolean {
    checkWorkspaceCopySelectionArgs(argv as Parameters<typeof checkWorkspaceCopySelectionArgs>[0])
    if (!argv.name)
        throw new Error('Укажите имя remote: `workspace remote get-url <name>`')
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace remote get-url <name>\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', { type: 'string', demandOption: true, desc: 'Имя remote' })
        .options({
            push: { type: 'boolean', desc: 'git remote get-url --push' },
            'get-url-all': {
                type: 'boolean',
                desc: 'Все URL (git remote get-url --all; не путать с --all выбора копий)',
            },
        })
        .check((argv) => checkGetUrlArgs(argv as Record<string, unknown>))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: Record<string, unknown>): Promise<void> => {
    const name = String(argv.name)
    const push = !!argv.push
    const allUrls = !!((argv['get-url-all'] ?? argv.getUrlAll) as boolean)

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
                const output = await new GitRemoteGetUrlCliHandler(abs, name, {
                    push,
                    all: allUrls,
                }).executeWithOutput()
                const lines = output.length === 0 ? [''] : output.split('\n')
                for (const line of lines)
                    console.log(`✔ ${rel}: ${line}`)
            } catch (e: unknown) {
                console.error(`✖ ${rel}: ${extractErrorDetail(e)}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось получить URL в ${failed} из ${copies.length} рабочих копий`)
            process.exitCode = 1
        }
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : String(e))
        process.exitCode = 1
    }
}
