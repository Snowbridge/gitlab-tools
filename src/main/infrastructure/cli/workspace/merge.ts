import yargs from 'yargs'
import * as path from 'path'
import { resolveWorkspaceCopies } from '../../../services/Workspace'
import { GitMergeCliHandler, GitMergeOptions, getGlobalDefaultBranch, hasBranch, hasLocalBranch } from '../../../services/GitCliHandlers/GitMergeCliHandler'
import { GitSwitchCliHandler } from '../../../services/GitCliHandlers/GitSwitchCliHandler'

export const command = 'merge <from> [to]'

export const describe = 'Слить ветку в текущие рабочие копии'

const DETAILED_DESCRIPTION = [
    'Сливает ветку <from> в ветку [to] каждой выбранной рабочей копии: switch на [to], git merge <from>, возврат switch -.',
    'Выбор копий — через resolveWorkspaceCopies с фильтром по веткам: --repos/-r (наследуется от workspace), либо --all, либо --interactive. Фильтр передается через ResolveWorkspaceOptions и отрабатывает до --all и --interactive.',
    'В фильтр попадают только копии с обеими ветками: <from> локально или на remote, [to] строго локально; остальные молча отсекаются, если таких все — ошибка.',
    '[to] по умолчанию — git config --global init.defaultBranch, фолбэк master; from == to — ранняя ошибка.',
    'git switch - выполняется всегда, даже после неуспеха; в конце суммарный отчет.',
].join('\n')

export function createMergeBranchFilter(from: string, to: string): (abs: string) => Promise<boolean> {
    return async (abs: string): Promise<boolean> => {
        if (!(await hasBranch(abs, from)))
            return false
        return hasLocalBranch(abs, to)
    }
}

export function argvToMergeOptions(argv: any): GitMergeOptions {
    const rawStrategy = argv['strategy-option'] ?? argv.strategyOption ?? argv.X
    const strategyOption: string[] | undefined = rawStrategy === undefined
        ? undefined
        : (Array.isArray(rawStrategy) ? rawStrategy : [rawStrategy])
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
    return {
        from: argv.from,
        noFf: !!((argv['no-ff'] ?? argv.noFf) as boolean),
        ffOnly: !!((argv['ff-only'] ?? argv.ffOnly) as boolean),
        squash: !!argv.squash,
        message: argv.message ?? argv.m,
        strategyOption,
    }
}

export function checkMergeArgs(argv: any): boolean {
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
    if (!argv.from) {
        throw new Error('Не указана ветка для слияния. Укажите <from>')
    }
    if (argv.to !== undefined && argv.from === argv.to) {
        throw new Error(`Ветки from и to совпадают: ${argv.from}`)
    }
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace merge <from> [to]\n\n${DETAILED_DESCRIPTION}`)
        .positional('from', {
            type: 'string',
            desc: 'Ветка-источник для git merge (обязательна)',
            demandOption: true,
        })
        .positional('to', {
            type: 'string',
            desc: 'Ветка-приемник (дефолт — init.defaultBranch, фолбэк master)',
        })
        .options({
            'no-ff': {
                type: 'boolean',
                desc: 'Создать merge-коммит даже при fast-forward (git merge --no-ff)',
            },
            'ff-only': {
                type: 'boolean',
                desc: 'Только fast-forward, иначе ошибка (git merge --ff-only)',
            },
            squash: {
                type: 'boolean',
                desc: 'Сжать изменения в один коммит (git merge --squash)',
            },
            message: {
                type: 'string',
                alias: 'm',
                desc: 'Сообщение merge-коммита (git merge -m)',
            },
            'strategy-option': {
                type: 'string',
                alias: 'X',
                array: true,
                desc: 'Опция merge-стратегии (git merge -X, можно несколько раз)',
            },
        })
        .check((argv) => checkMergeArgs(argv as any))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: any): Promise<void> => {
    const dir: string = argv.dir ?? '.'
    const all: boolean = !!argv.all
    const interactive: boolean = !!argv.interactive
    const repos: string[] = argv.repos ?? []
    const options = argvToMergeOptions(argv)
    const from: string = options.from

    try {
        const to: string = argv.to ?? await getGlobalDefaultBranch()

        if (from === to) {
            throw new Error(`Ветки from и to совпадают: ${from}`)
        }

        const branchFilter = createMergeBranchFilter(from, to)

        let copies: string[]
        try {
            copies = await resolveWorkspaceCopies({
                dir,
                all,
                interactive,
                repos,
                filter: branchFilter,
            })
        } catch (e: unknown) {
            if (e instanceof Error && e.message.startsWith('Не найдено рабочих копий в')) {
                throw new Error(`Не найдено рабочих копий с ветками ${from} и ${to}`)
            }
            throw e
        }

        // --repos игнорирует filter внутри resolveWorkspaceCopies: применяем тот же предикат здесь (молча)
        if (repos.length > 0) {
            const filtered: string[] = []
            for (const abs of copies) {
                if (await branchFilter(abs))
                    filtered.push(abs)
            }
            copies = filtered
        }

        const resolvedDir = path.resolve(dir)

        if (copies.length === 0) {
            console.error(`Не найдено рабочих копий с ветками ${from} и ${to}`)
            process.exitCode = 1
            return
        }

        let failed = 0
        for (const abs of copies) {
            const rel = path.relative(resolvedDir, abs) || '.'
            let copyFailed = false
            try {
                await new GitSwitchCliHandler(abs, { branch: to }).execute()
            } catch (e: unknown) {
                const detail = extractErrorDetail(e)
                console.error(`✖ ${rel}: ${detail}`)
                copyFailed = true
                try {
                    await new GitSwitchCliHandler(abs, { branch: '-' }).execute()
                } catch {
                    // switch - best effort, fail уже зафиксирован
                }
                failed += 1
                continue
            }
            try {
                await new GitMergeCliHandler(abs, options).execute()
            } catch (e: unknown) {
                const detail = extractErrorDetail(e)
                console.error(`✖ ${rel}: ${detail}`)
                copyFailed = true
            } finally {
                try {
                    await new GitSwitchCliHandler(abs, { branch: '-' }).execute()
                } catch (e: unknown) {
                    const detail = extractErrorDetail(e)
                    console.error(`✖ ${rel}: ${detail}`)
                    copyFailed = true
                }
            }
            if (copyFailed) {
                failed += 1
            } else {
                console.log(`✔ ${rel}: ${from} → ${to}`)
            }
        }
        if (failed > 0) {
            console.error(`Не удалось смержить ${failed} из ${copies.length} рабочих копий`)
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
