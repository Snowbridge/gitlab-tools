import yargs from 'yargs'
import * as path from 'path'
import { resolveWorkspaceCopies } from '../../../services/Workspace'
import { GitSwitchCliHandler, GitSwitchOptions } from '../../../services/GitCliHandlers/GitSwitchCliHandler'

export const command = 'switch [branch]'

export const describe = 'Переключить рабочие копии на ветку'

const DETAILED_DESCRIPTION = [
    'Переключает выбранные рабочие копии на указанную ветку: аналог `git -C <copy> switch ...` для каждой копии.',
    'Выбор копий — через resolveWorkspaceCopies: --repos/-r (наследуется от workspace), либо --all, либо --interactive.',
    'Флаги повторяют git switch и прокидываются в команду без своей логики; режимы --detach/--orphan не поддерживаются.',
    '<branch> обязательна, кроме случая -c/-C (тогда это start-point, по умолчанию HEAD): `git switch -c <new-branch> [<branch>]`.',
].join('\n')

export function argvToSwitchOptions(argv: any): GitSwitchOptions {
    return {
        branch: argv.branch,
        create: argv.create ?? argv.c,
        forceCreate: argv['force-create'] ?? argv.forceCreate ?? argv.C,
        force: !!(argv.force ?? argv.f),
        merge: !!(argv.merge ?? argv.m),
        discardChanges: !!(argv['discard-changes'] ?? argv.discardChanges),
        track: !!(argv.track ?? argv.t),
        noTrack: !!(argv['no-track'] ?? argv.noTrack),
        guess: !!argv.guess,
        noGuess: !!(argv['no-guess'] ?? argv.noGuess),
        quiet: !!(argv.quiet ?? argv.q),
        progress: !!argv.progress,
        noProgress: !!(argv['no-progress'] ?? argv.noProgress),
        recurseSubmodules: !!(argv['recurse-submodules'] ?? argv.recurseSubmodules),
        noRecurseSubmodules:
            !!(argv['no-recurse-submodules'] ?? argv.noRecurseSubmodules),
        ignoreOtherWorktrees:
            !!(argv['ignore-other-worktrees'] ?? argv.ignoreOtherWorktrees),
    }
}

export function checkSwitchArgs(argv: any): boolean {
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
    if (!argv.branch && !argv.create && !argv.c && !argv['force-create'] && !argv.forceCreate && !argv.C) {
        throw new Error('Не указана ветка. Укажите <branch> или используйте -c/-C для создания новой ветки')
    }
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace switch [branch]\n\n${DETAILED_DESCRIPTION}`)
        .positional('branch', {
            type: 'string',
            desc: 'Ветка/start-point для git switch (обязательна, кроме случая -c/-C)',
        })
        .options({
            create: {
                type: 'string',
                alias: 'c',
                desc: 'Создать новую ветку (git switch --create)',
            },
            'force-create': {
                type: 'string',
                alias: 'C',
                desc: 'Создать/пересоздать ветку (git switch --force-create)',
            },
            force: {
                type: 'boolean',
                alias: 'f',
                desc: 'Разрешить переключение при конфликтах (git switch --force)',
            },
            merge: {
                type: 'boolean',
                alias: 'm',
                desc: 'Попытаться перенести локальные изменения (git switch --merge)',
            },
            'discard-changes': {
                type: 'boolean',
                desc: 'Сбросить локальные изменения (git switch --discard-changes)',
            },
            track: {
                type: 'boolean',
                alias: 't',
                desc: 'Настроить upstream (git switch --track)',
            },
            'no-track': {
                type: 'boolean',
                desc: 'Не настраивать upstream (git switch --no-track)',
            },
            guess: {
                type: 'boolean',
                desc: 'Автоподбор remote-ветки (git switch --guess)',
            },
            'no-guess': {
                type: 'boolean',
                desc: 'Отключить автоподбор (git switch --no-guess)',
            },
            quiet: {
                type: 'boolean',
                alias: 'q',
                desc: 'Тихий режим (git switch --quiet)',
            },
            progress: {
                type: 'boolean',
                desc: 'Показывать прогресс (git switch --progress)',
            },
            'no-progress': {
                type: 'boolean',
                desc: 'Не показывать прогресс (git switch --no-progress)',
            },
            'recurse-submodules': {
                type: 'boolean',
                desc: 'Обновить подмодули (git switch --recurse-submodules)',
            },
            'no-recurse-submodules': {
                type: 'boolean',
                desc: 'Не трогать подмодули (git switch --no-recurse-submodules)',
            },
            'ignore-other-worktrees': {
                type: 'boolean',
                desc: 'Игнорировать проверку других worktree (git switch --ignore-other-worktrees)',
            },
        })
        .check((argv) => checkSwitchArgs(argv as any))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: any): Promise<void> => {
    const dir: string = argv.dir ?? '.'
    const all: boolean = !!argv.all
    const interactive: boolean = !!argv.interactive
    const repos: string[] = argv.repos ?? []
    const options = argvToSwitchOptions(argv)
    const branch: string | undefined = options.branch
    const label: string = branch ?? options.create ?? options.forceCreate ?? ''

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
                await new GitSwitchCliHandler(abs, options).execute()
                console.log(`✔ ${rel} → ${label}`)
            } catch (e: unknown) {
                const detail = extractErrorDetail(e)
                console.error(`✖ ${rel}: ${detail}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось переключить ${failed} из ${copies.length} рабочих копий`)
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
