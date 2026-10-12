import yargs from 'yargs'
import {
    GitRemoteAddCliHandler,
    GitRemoteAddOptions,
} from '../../../../services/GitCliHandlers/GitRemoteCliHandler'
import {
    checkWorkspaceCopySelectionArgs,
    extractErrorDetail,
    relPath,
    resolveCopiesFromArgv,
} from './_shared'

export const command = 'add <name> <url>'

export const describe = 'Добавить remote в рабочих копиях'

const DETAILED_DESCRIPTION = [
    'Выполняет `git remote add` в каждой выбранной рабочей копии.',
    'Флаги повторяют git remote add (-f, --tags, -t, -m, --mirror).',
].join('\n')

export function argvToAddOptions(argv: Record<string, unknown>): GitRemoteAddOptions {
    const rawTrack = argv.track ?? argv.t
    const track: string[] | undefined = rawTrack === undefined
        ? undefined
        : (Array.isArray(rawTrack) ? rawTrack : [rawTrack])
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
    const rawMirror = argv.mirror
    let mirror: boolean | 'push' | 'fetch' | undefined
    if (rawMirror === true)
        mirror = true
    else if (rawMirror === 'push' || rawMirror === 'fetch')
        mirror = rawMirror
    else if (rawMirror === '' || rawMirror === 'true')
        mirror = true
    return {
        fetch: !!((argv.fetch ?? argv.f) as boolean),
        tags: !!argv.tags,
        noTags: !!((argv['no-tags'] ?? argv.noTags) as boolean),
        track,
        master: (argv.master ?? argv.m) as string | undefined,
        mirror,
    }
}

export function checkAddArgs(argv: Record<string, unknown>): boolean {
    checkWorkspaceCopySelectionArgs(argv as Parameters<typeof checkWorkspaceCopySelectionArgs>[0])
    if (!argv.name)
        throw new Error('Укажите имя remote: `workspace remote add <name> <url>`')
    if (!argv.url)
        throw new Error('Укажите URL: `workspace remote add <name> <url>`')
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace remote add <name> <url>\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', { type: 'string', demandOption: true, desc: 'Имя remote' })
        .positional('url', { type: 'string', demandOption: true, desc: 'URL remote' })
        .options({
            fetch: { type: 'boolean', alias: 'f', desc: 'git remote add --fetch' },
            tags: { type: 'boolean', desc: 'git remote add --tags' },
            'no-tags': { type: 'boolean', desc: 'git remote add --no-tags' },
            track: { type: 'string', array: true, alias: 't', desc: 'git remote add -t <branch>' },
            master: { type: 'string', alias: 'm', desc: 'git remote add -m <branch>' },
            mirror: {
                type: 'string',
                nargs: 0,
                desc: 'git remote add --mirror (без значения) или --mirror=push|fetch',
            },
        })
        .check((argv) => checkAddArgs(argv as Record<string, unknown>))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: Record<string, unknown>): Promise<void> => {
    const options = argvToAddOptions(argv)
    const name = String(argv.name)
    const url = String(argv.url)

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
                await new GitRemoteAddCliHandler(abs, name, url, options).execute()
                console.log(`✔ ${rel}`)
            } catch (e: unknown) {
                console.error(`✖ ${rel}: ${extractErrorDetail(e)}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось добавить remote в ${failed} из ${copies.length} рабочих копий`)
            process.exitCode = 1
        }
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : String(e))
        process.exitCode = 1
    }
}
