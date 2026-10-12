import yargs from 'yargs'
import {
    GitRemoteSetBranchesCliHandler,
    GitRemoteSetBranchesOptions,
} from '../../../../services/GitCliHandlers/GitRemoteCliHandler'
import {
    checkWorkspaceCopySelectionArgs,
    extractErrorDetail,
    relPath,
    resolveCopiesFromArgv,
    skipIfRemoteMissing,
} from './_shared'

export const command = 'set-branches <name> [branch..]'

export const describe = 'Ограничить список отслеживаемых веток remote'

const DETAILED_DESCRIPTION = [
    'Выполняет `git remote set-branches` в каждой выбранной рабочей копии.',
    'Режимы --add / --delete (только длинные формы, без -d).',
    'Укажите ветки как позиционные [branch..] после <name>.',
].join('\n')

export function argvToSetBranchesOptions(argv: Record<string, unknown>): GitRemoteSetBranchesOptions {
    const rawBranch = argv.branch
    const branches: string[] = rawBranch === undefined
        ? []
        : (Array.isArray(rawBranch) ? rawBranch : [rawBranch])
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
    return {
        add: !!argv.add,
        noAdd: !!((argv['no-add'] ?? argv.noAdd) as boolean),
        delete: !!argv.delete,
        noDelete: !!((argv['no-delete'] ?? argv.noDelete) as boolean),
        branches,
    }
}

export function checkSetBranchesArgs(argv: Record<string, unknown>): boolean {
    checkWorkspaceCopySelectionArgs(argv as Parameters<typeof checkWorkspaceCopySelectionArgs>[0])
    if (!argv.name)
        throw new Error('Укажите имя remote: `workspace remote set-branches <name> [branch..]`')
    const options = argvToSetBranchesOptions(argv)
    const modeCount = [options.add, options.noAdd, options.delete, options.noDelete].filter(Boolean).length
    if (modeCount > 1)
        throw new Error('Опции --add, --no-add, --delete и --no-delete взаимоисключающие')
    if (options.branches.length === 0)
        throw new Error('Укажите хотя бы одну ветку: `workspace remote set-branches <name> <branch>...`')
    return true
}

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace remote set-branches <name> [branch..]\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', { type: 'string', demandOption: true, desc: 'Имя remote' })
        .positional('branch', {
            type: 'string',
            array: true,
            desc: 'Ветки для set-branches',
        })
        .options({
            add: { type: 'boolean', desc: 'git remote set-branches --add' },
            'no-add': { type: 'boolean', desc: 'git remote set-branches --no-add' },
            delete: { type: 'boolean', desc: 'git remote set-branches --delete (без алиаса -d)' },
            'no-delete': { type: 'boolean', desc: 'git remote set-branches --no-delete' },
        })
        .check((argv) => checkSetBranchesArgs(argv as Record<string, unknown>))
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: Record<string, unknown>): Promise<void> => {
    const name = String(argv.name)
    const options = argvToSetBranchesOptions(argv)

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
                await new GitRemoteSetBranchesCliHandler(abs, name, options).execute()
                console.log(`✔ ${rel}`)
            } catch (e: unknown) {
                console.error(`✖ ${rel}: ${extractErrorDetail(e)}`)
                failed += 1
            }
        }
        if (failed > 0) {
            console.error(`Не удалось set-branches в ${failed} из ${copies.length} рабочих копий`)
            process.exitCode = 1
        }
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : String(e))
        process.exitCode = 1
    }
}
