import yargs from 'yargs'
import * as path from 'path'
import { resolveWorkspaceCopies } from '../../../services/Workspace'
import { GitPullCliHandler, GitPullOptions } from '../../../services/GitCliHandlers/GitPullCliHandler'

export const command = 'pull [remote] [branch..]'

export const describe = 'Выполнить git pull в рабочих копиях'

const DETAILED_DESCRIPTION = [
    'Выполняет `git pull` в каждой выбранной рабочей копии: аналог `git pull ...` для каждой копии.',
    'Выбор копий — через resolveWorkspaceCopies: --repos/-r (наследуется от workspace), либо --all, либо --interactive.',
    'Флаги повторяют git pull и прокидываются в команду без своей логики.',
    'Без позиционных аргументов — pull upstream текущей ветки; [remote] — remote, [branch...] — ветки.',
    'Опция --all/-a выбирает все копии из --dir; флаг `git pull --all` прокидывается отдельной опцией --pull-all.',
].join('\n')

export function argvToPullOptions(argv: any): GitPullOptions {
    const rawBranch = argv.branch
    const branches: string[] | undefined = rawBranch === undefined
        ? undefined
        : (Array.isArray(rawBranch) ? rawBranch : [rawBranch])
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
    const rawStrategyOption = argv['strategy-option'] ?? argv.strategyOption ?? argv.X
    const strategyOption: string[] | undefined = rawStrategyOption === undefined
        ? undefined
        : (Array.isArray(rawStrategyOption) ? rawStrategyOption : [rawStrategyOption])
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
    const rawJobs = argv.jobs ?? argv.j
    return {
        remote: argv.remote,
        branches,
        quiet: !!((argv.quiet ?? argv.q) as boolean),
        verbose: !!((argv.verbose ?? argv.v) as boolean),
        progress: !!argv.progress,
        noProgress: !!((argv['no-progress'] ?? argv.noProgress) as boolean),
        rebase: !!argv.rebase,
        noRebase: !!((argv['no-rebase'] ?? argv.noRebase) as boolean),
        ffOnly: !!((argv['ff-only'] ?? argv.ffOnly) as boolean),
        autostash: !!argv.autostash,
        noAutostash: !!((argv['no-autostash'] ?? argv.noAutostash) as boolean),
        pullAll: !!((argv['pull-all'] ?? argv.pullAll) as boolean),
        prune: !!((argv.prune ?? argv.p) as boolean),
        force: !!((argv.force ?? argv.f) as boolean),
        tags: !!argv.tags,
        noTags: !!((argv['no-tags'] ?? argv.noTags) as boolean),
        allowUnrelatedHistories: !!((argv['allow-unrelated-histories'] ?? argv.allowUnrelatedHistories) as boolean),
        noCommit: !!((argv['no-commit'] ?? argv.noCommit) as boolean),
        commit: !!argv.commit,
        squash: !!argv.squash,
        noEdit: !!((argv['no-edit'] ?? argv.noEdit) as boolean),
        edit: !!((argv.edit ?? argv.e) as boolean),
        strategy: argv.strategy ?? argv.s,
        strategyOption,
        jobs: rawJobs === undefined ? undefined : Number(rawJobs),
        recurseSubmodules: !!((argv['recurse-submodules'] ?? argv.recurseSubmodules) as boolean),
        noRecurseSubmodules: !!((argv['no-recurse-submodules'] ?? argv.noRecurseSubmodules) as boolean),
    }
}

export function checkPullArgs(argv: any): boolean {
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
    const rebaseCount = [argv.rebase, argv['no-rebase'] ?? argv.noRebase, argv['ff-only'] ?? argv.ffOnly]
        .filter(Boolean).length
    if (rebaseCount > 1) {
        throw new Error('Опции --rebase, --no-rebase и --ff-only взаимоисключающие')
    }
    const rawBranch = argv.branch
    const branches: string[] = rawBranch === undefined
        ? []
        : (Array.isArray(rawBranch) ? rawBranch : [rawBranch]).map((v) => String(v))
    if (branches.length > 0 && !argv.remote) {
        throw new Error('Ветка указана без remote. Укажите remote перед веткой: `workspace pull <remote> [branch...]`')
    }
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace pull [remote] [branch..]\n\n${DETAILED_DESCRIPTION}`)
        .positional('remote', {
            type: 'string',
            desc: 'Remote для git pull (по умолчанию — upstream текущей ветки)',
        })
        .positional('branch', {
            type: 'string',
            desc: 'Ветки для git pull (требует указания remote)',
        })
        .options({
            quiet: {
                type: 'boolean',
                alias: 'q',
                desc: 'Тихий режим (git pull --quiet)',
            },
            verbose: {
                type: 'boolean',
                alias: 'v',
                desc: 'Подробный вывод (git pull --verbose)',
            },
            progress: {
                type: 'boolean',
                desc: 'Показывать прогресс (git pull --progress)',
            },
            'no-progress': {
                type: 'boolean',
                desc: 'Не показывать прогресс (git pull --no-progress)',
            },
            rebase: {
                type: 'boolean',
                desc: 'Ребейз вместо мержа (git pull --rebase)',
            },
            'no-rebase': {
                type: 'boolean',
                desc: 'Мерж вместо ребейза (git pull --no-rebase)',
            },
            'ff-only': {
                type: 'boolean',
                desc: 'Только fast-forward (git pull --ff-only)',
            },
            autostash: {
                type: 'boolean',
                desc: 'Автоstash перед pull (git pull --autostash)',
            },
            'no-autostash': {
                type: 'boolean',
                desc: 'Отключить автоstash (git pull --no-autostash)',
            },
            'pull-all': {
                type: 'boolean',
                desc: 'Забрать все remote (git pull --all; --all/-a выбирает копии, см. описание)',
            },
            prune: {
                type: 'boolean',
                alias: 'p',
                desc: 'Удалить remote-ветки без соответствия (git pull --prune)',
            },
            force: {
                type: 'boolean',
                alias: 'f',
                desc: 'Принудительное обновление (git pull --force)',
            },
            tags: {
                type: 'boolean',
                desc: 'Забрать теги (git pull --tags)',
            },
            'no-tags': {
                type: 'boolean',
                desc: 'Не забирать теги (git pull --no-tags)',
            },
            'allow-unrelated-histories': {
                type: 'boolean',
                desc: 'Разрешить слияние несвязанных историй (git pull --allow-unrelated-histories)',
            },
            'no-commit': {
                type: 'boolean',
                desc: 'Не коммитить мерж (git pull --no-commit)',
            },
            commit: {
                type: 'boolean',
                desc: 'Коммитить мерж (git pull --commit)',
            },
            squash: {
                type: 'boolean',
                desc: 'Сжать изменения (git pull --squash)',
            },
            'no-edit': {
                type: 'boolean',
                desc: 'Не открывать редактор коммита (git pull --no-edit)',
            },
            edit: {
                type: 'boolean',
                alias: 'e',
                desc: 'Открыть редактор коммита (git pull --edit)',
            },
            strategy: {
                type: 'string',
                alias: 's',
                desc: 'Стратегия мержа (git pull --strategy)',
            },
            'strategy-option': {
                type: 'string',
                alias: 'X',
                array: true,
                desc: 'Опция merge-стратегии (git pull -X, можно несколько раз)',
            },
            jobs: {
                type: 'number',
                alias: 'j',
                desc: 'Число параллельных fetch-заданий (git pull --jobs)',
            },
            'recurse-submodules': {
                type: 'boolean',
                desc: 'Обновить подмодули (git pull --recurse-submodules)',
            },
            'no-recurse-submodules': {
                type: 'boolean',
                desc: 'Не трогать подмодули (git pull --no-recurse-submodules)',
            },
        })
        .check((argv) => checkPullArgs(argv as any))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: any): Promise<void> => {
    const dir: string = argv.dir ?? '.'
    const all: boolean = !!argv.all
    const interactive: boolean = !!argv.interactive
    const repos: string[] = argv.repos ?? []
    const options = argvToPullOptions(argv)

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
                await new GitPullCliHandler(abs, options).execute()
                console.log(`✔ ${rel}`)
            } catch (e: unknown) {
                const detail = extractErrorDetail(e)
                console.error(`✖ ${rel}: ${detail}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось выполнить pull ${failed} из ${copies.length} рабочих копий`)
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
