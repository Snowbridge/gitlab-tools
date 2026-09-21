import yargs from 'yargs'
import * as path from 'path'
import { resolveWorkspaceCopies } from '../../../services/Workspace'
import { GitStatusCliHandler, GitStatusOptions } from '../../../services/GitCliHandlers/GitStatusCliHandler'

export const command = 'status'

export const describe = 'Показать git status рабочих копий'

const DETAILED_DESCRIPTION = [
    'Выполняет `git status` в каждой выбранной рабочей копии и печатает вывод с заголовком `=== <копия> ===`.',
    'Выбор копий — через resolveWorkspaceCopies: --repos/-r (наследуется от workspace), либо --all, либо --interactive.',
    'Флаги повторяют git status и прокидываются в команду без своей логики; pathspec не поддерживается.',
    'Опции с опциональным значением: --porcelain[=v1|v2], --untracked-files[=no|normal|all] (-u), --ignored[=traditional|matching|no].',
    'Слитная короткая форма -u<mode> (например -unormal) не разбирается yargs — используйте `-u <mode>` или `--untracked-files=<mode>`.',
].join('\n')

function normalizeOptionalValue(raw: unknown): boolean | string | undefined {
    if (raw === undefined || raw === null || raw === false)
        return undefined
    if (raw === true || raw === '')
        return true
    const s = String(raw)
    if (s === '')
        return true
    return s
}

export function argvToStatusOptions(argv: any): GitStatusOptions {
    return {
        short: !!(argv.short ?? argv.s),
        branch: !!(argv.branch ?? argv.b),
        porcelain: normalizeOptionalValue(argv.porcelain),
        showStash: !!(argv['show-stash'] ?? argv.showStash),
        untrackedFiles: normalizeOptionalValue(argv['untracked-files'] ?? argv.untrackedFiles ?? argv.u),
        ignored: normalizeOptionalValue(argv.ignored),
        verbose: !!(argv.verbose ?? argv.v),
    }
}

export function checkStatusArgs(argv: any): boolean {
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
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace status\n\n${DETAILED_DESCRIPTION}`)
        .options({
            short: {
                type: 'boolean',
                alias: 's',
                desc: 'Короткий формат (git status --short)',
            },
            branch: {
                type: 'boolean',
                alias: 'b',
                desc: 'Показать информацию о ветке даже в коротком формате (git status --branch)',
            },
            porcelain: {
                type: 'string',
                desc: 'Машиночитаемый формат (git status --porcelain[=v1|v2], без значения — v1)',
            },
            'show-stash': {
                type: 'boolean',
                desc: 'Показать число записей stash (git status --show-stash)',
            },
            'untracked-files': {
                type: 'string',
                alias: 'u',
                desc: 'Режим untracked-файлов (git status --untracked-files[=no|normal|all], без значения — показать)',
            },
            ignored: {
                type: 'string',
                desc: 'Показать игнорируемые файлы (git status --ignored[=traditional|matching|no], без значения — traditional)',
            },
            verbose: {
                type: 'boolean',
                alias: 'v',
                desc: 'Показать дифф staged-изменений (git status --verbose)',
            },
        })
        .check((argv) => checkStatusArgs(argv as any))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: any): Promise<void> => {
    const dir: string = argv.dir ?? '.'
    const all: boolean = !!argv.all
    const interactive: boolean = !!argv.interactive
    const repos: string[] = argv.repos ?? []
    const options = argvToStatusOptions(argv)

    try {
        const copies = await resolveWorkspaceCopies({
            dir,
            all,
            interactive,
            repos,
        })

        const resolvedDir = path.resolve(dir)
        let failed = 0
        for (let i = 0; i < copies.length; i++) {
            const abs = copies[i]
            const rel = path.relative(resolvedDir, abs) || '.'
            try {
                const output = await new GitStatusCliHandler(abs, options).executeWithOutput()
                console.log(`=== ${rel} ===`)
                if (output)
                    console.log(output)
                if (i < copies.length - 1)
                    console.log('')
            } catch (e: unknown) {
                const detail = extractErrorDetail(e)
                console.error(`✖ ${rel}: ${detail}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось получить status ${failed} из ${copies.length} рабочих копий`)
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
