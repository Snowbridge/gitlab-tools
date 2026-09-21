import yargs from 'yargs'
import * as path from 'path'
import { resolveWorkspaceCopies } from '../../../services/Workspace'
import { GitFetchCliHandler, GitFetchOptions } from '../../../services/GitCliHandlers/GitFetchCliHandler'

export const command = 'fetch [remote] [refspec..]'

export const describe = 'Выполнить git fetch в рабочих копиях'

const DETAILED_DESCRIPTION = [
    'Выполняет `git fetch` в каждой выбранной рабочей копии: аналог `git fetch ...` для каждой копии.',
    'Выбор копий — через resolveWorkspaceCopies: --repos/-r (наследуется от workspace), либо --all, либо --interactive.',
    'Флаги повторяют git fetch и прокидываются в команду без своей логики.',
    'Без позиционных аргументов — fetch default remote; [remote] — remote, [refspec...] — refspec.',
    'Опция --all/-a выбирает все копии из --dir; флаг `git fetch --all` прокидывается отдельной опцией --fetch-all.',
    'Опция --append без короткого алиаса: -a зарезервирован workspace для выбора копий.',
].join('\n')

export function argvToFetchOptions(argv: any): GitFetchOptions {
    const rawRefspec = argv.refspec
    const refspecs: string[] | undefined = rawRefspec === undefined
        ? undefined
        : (Array.isArray(rawRefspec) ? rawRefspec : [rawRefspec])
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
    const rawShallowExclude = argv['shallow-exclude'] ?? argv.shallowExclude
    const shallowExclude: string[] | undefined = rawShallowExclude === undefined
        ? undefined
        : (Array.isArray(rawShallowExclude) ? rawShallowExclude : [rawShallowExclude])
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
    const rawJobs = argv.jobs ?? argv.j
    const rawDepth = argv.depth
    const rawDeepen = argv.deepen
    return {
        remote: argv.remote,
        refspecs,
        quiet: !!((argv.quiet ?? argv.q) as boolean),
        verbose: !!((argv.verbose ?? argv.v) as boolean),
        progress: !!argv.progress,
        noProgress: !!((argv['no-progress'] ?? argv.noProgress) as boolean),
        fetchAll: !!((argv['fetch-all'] ?? argv.fetchAll) as boolean),
        prune: !!((argv.prune ?? argv.p) as boolean),
        pruneTags: !!((argv['prune-tags'] ?? argv.pruneTags ?? argv.P) as boolean),
        force: !!((argv.force ?? argv.f) as boolean),
        tags: !!((argv.tags ?? argv.t) as boolean),
        noTags: !!((argv['no-tags'] ?? argv.noTags) as boolean),
        jobs: rawJobs === undefined ? undefined : Number(rawJobs),
        depth: rawDepth === undefined ? undefined : Number(rawDepth),
        deepen: rawDeepen === undefined ? undefined : Number(rawDeepen),
        shallowSince: argv['shallow-since'] ?? argv.shallowSince,
        shallowExclude,
        unshallow: !!argv.unshallow,
        updateShallow: !!((argv['update-shallow'] ?? argv.updateShallow) as boolean),
        append: !!argv.append,
        dryRun: !!((argv['dry-run'] ?? argv.dryRun) as boolean),
        recurseSubmodules: !!((argv['recurse-submodules'] ?? argv.recurseSubmodules) as boolean),
        noRecurseSubmodules: !!((argv['no-recurse-submodules'] ?? argv.noRecurseSubmodules) as boolean),
    }
}

export function checkFetchArgs(argv: any): boolean {
    const repos = (argv.repos as string[]) ?? []
    const all = !!argv.all
    const interactive = !!argv.interactive
    if (all && interactive)
        throw new Error('Опции --interactive и --all не могут использоваться вместе')
    if (repos.length > 0 && (all || interactive)) {
        throw new Error('Нельзя указывать рабочие копии вместе с --all или --interactive')
    }
    if (repos.length === 0 && !all && !interactive) {
        throw new Error('Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive')
    }
    const rawRefspec = argv.refspec
    const refspecs: string[] = rawRefspec === undefined
        ? []
        : (Array.isArray(rawRefspec) ? rawRefspec : [rawRefspec]).map((v) => String(v))
    if (refspecs.length > 0 && !argv.remote) {
        throw new Error('Refspec указан без remote. Укажите remote перед refspec: `workspace fetch <remote> [refspec...]`')
    }
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace fetch [remote] [refspec..]\n\n${DETAILED_DESCRIPTION}`)
        .positional('remote', {
            type: 'string',
            desc: 'Remote для git fetch (по умолчанию — default remote)',
        })
        .positional('refspec', {
            type: 'string',
            desc: 'Refspec для git fetch (требует указания remote)',
        })
        .options({
            quiet: {
                type: 'boolean',
                alias: 'q',
                desc: 'Тихий режим (git fetch --quiet)',
            },
            verbose: {
                type: 'boolean',
                alias: 'v',
                desc: 'Подробный вывод (git fetch --verbose)',
            },
            progress: {
                type: 'boolean',
                desc: 'Показывать прогресс (git fetch --progress)',
            },
            'no-progress': {
                type: 'boolean',
                desc: 'Не показывать прогресс (git fetch --no-progress)',
            },
            'fetch-all': {
                type: 'boolean',
                desc: 'Забрать все remote (git fetch --all; --all/-a выбирает копии, см. описание)',
            },
            prune: {
                type: 'boolean',
                alias: 'p',
                desc: 'Удалить remote-ветки без соответствия (git fetch --prune)',
            },
            'prune-tags': {
                type: 'boolean',
                alias: 'P',
                desc: 'Удалить локальные теги без соответствия на remote (git fetch --prune-tags)',
            },
            force: {
                type: 'boolean',
                alias: 'f',
                desc: 'Принудительное обновление (git fetch --force)',
            },
            tags: {
                type: 'boolean',
                alias: 't',
                desc: 'Забрать все теги (git fetch --tags)',
            },
            'no-tags': {
                type: 'boolean',
                desc: 'Не забирать теги автоматически (git fetch --no-tags)',
            },
            jobs: {
                type: 'number',
                alias: 'j',
                desc: 'Число параллельных заданий (git fetch --jobs)',
            },
            depth: {
                type: 'number',
                desc: 'Ограничить историю N коммитами (git fetch --depth)',
            },
            deepen: {
                type: 'number',
                desc: 'Углубить историю на N коммитов (git fetch --deepen)',
            },
            'shallow-since': {
                type: 'string',
                desc: 'Усечь историю после даты (git fetch --shallow-since)',
            },
            'shallow-exclude': {
                type: 'string',
                array: true,
                desc: 'Исключить ревизии из shallow-границы (git fetch --shallow-exclude, можно несколько раз)',
            },
            unshallow: {
                type: 'boolean',
                desc: 'Снять shallow-ограничение (git fetch --unshallow)',
            },
            'update-shallow': {
                type: 'boolean',
                desc: 'Обновить shallow-границу (git fetch --update-shallow)',
            },
            append: {
                type: 'boolean',
                desc: 'Дописать в FETCH_HEAD вместо перезаписи (git fetch --append; без алиаса -a)',
            },
            'dry-run': {
                type: 'boolean',
                desc: 'Показать, что было бы сделано (git fetch --dry-run)',
            },
            'recurse-submodules': {
                type: 'boolean',
                desc: 'Забрать подмодули (git fetch --recurse-submodules)',
            },
            'no-recurse-submodules': {
                type: 'boolean',
                desc: 'Не трогать подмодули (git fetch --no-recurse-submodules)',
            },
        })
        .check((argv) => checkFetchArgs(argv as any))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: any): Promise<void> => {
    const dir: string = argv.dir ?? '.'
    const all: boolean = !!argv.all
    const interactive: boolean = !!argv.interactive
    const repos: string[] = argv.repos ?? []
    const options = argvToFetchOptions(argv)

    try {
        const copies = await resolveWorkspaceCopies({
            dir,
            all,
            interactive,
            repos,
        })

        const resolvedDir = path.resolve(dir)
        let failed = 0
        for (const abs of copies) {
            const rel = path.relative(resolvedDir, abs) || '.'
            try {
                await new GitFetchCliHandler(abs, options).execute()
                console.log(`✔ ${rel}`)
            } catch (e: unknown) {
                const detail = extractErrorDetail(e)
                console.error(`✖ ${rel}: ${detail}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось выполнить fetch ${failed} из ${copies.length} рабочих копий`)
            process.exitCode = 1
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        console.error(message)
        process.exitCode = 1
    }
}

function extractErrorDetail(e: unknown): string {
    if (e && typeof e === 'object') {
        const anyErr = e as any
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
