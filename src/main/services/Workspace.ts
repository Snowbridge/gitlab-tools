import * as fs from 'fs'
import * as path from 'path'
import Enquirer from 'enquirer'

export type WorkspaceFilter = (workspacePath: string, workspaceName: string) => boolean | Promise<boolean>

export function isWorkingCopy(dir: string): boolean {
    const gitPath = path.join(dir, '.git')
    try {
        return fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()
    } catch {
        return false
    }
}

export async function findWorkingCopies(rootDir: string, filter?: WorkspaceFilter): Promise<string[]> {
    const result: string[] = []
    const absRoot = path.resolve(rootDir)

    function walk(current: string): void {
        if (isWorkingCopy(current)) {
            result.push(current)
            return
        }

        let entries: fs.Dirent[]
        try {
            entries = fs.readdirSync(current, { withFileTypes: true })
        } catch {
            return
        }

        for (const entry of entries) {
            if (entry.name === '.git')
                continue
            // do not follow symlinks
            if (!entry.isDirectory())
                continue
            const full = path.join(current, entry.name)
            walk(full)
        }
    }

    walk(absRoot)
    const sorted = result.sort((a, b) => a.localeCompare(b))
    if (!filter)
        return sorted
    const filtered: string[] = []
    for (const abs of sorted) {
        const name = path.basename(abs)
        if (await filter(abs, name))
            filtered.push(abs)
    }
    return filtered
}

export async function promptWorkspaceSelection(copies: string[], dir: string): Promise<string[]> {
    if (copies.length === 0)
        return []

    const relativeChoices = copies.map((abs) => {
        const rel = path.relative(dir, abs)
        return rel === '' ? '.' : rel
    })

    const choices = copies.map((abs, idx) => ({
        name: abs,
        message: relativeChoices[idx],
    }))

    const enquirer = new Enquirer() as any
    const answer = await enquirer.prompt({
        type: 'autocomplete',
        name: 'workspaces',
        message: 'Выберите рабочие копии (печать фильтрует, space-выбор, a-все)',
        multiple: true,
        limit: 20,
        choices,
        suggest(input: string, choices: any[]) {
            const q = (input || '').toLowerCase()
            if (!q) return choices
            return choices.filter((ch) => ch.message.toLowerCase().includes(q))
        },
    } as any)

    const selected: string[] = (answer as any).workspaces ?? []
    return selected
}

export interface ResolveWorkspaceOptions {
    dir: string
    all: boolean
    interactive: boolean
    repos: string[]
    filter?: WorkspaceFilter
}

export async function resolveWorkspaceCopies(opts: ResolveWorkspaceOptions): Promise<string[]> {
    const resolvedDir = path.resolve(opts.dir)

    try {
        const stat = fs.statSync(resolvedDir)
        if (!stat.isDirectory())
            throw new Error(`Каталог не существует: ${resolvedDir}`)
    } catch (e: unknown) {
        if (e instanceof Error && e.message.startsWith('Каталог не существует'))
            throw e
        throw new Error(`Каталог не существует: ${resolvedDir}`)
    }

    const repos = opts.repos ?? []

    if (repos.length > 0 && (opts.all || opts.interactive)) {
        throw new Error('Нельзя указывать рабочие копии вместе с --all или --interactive')
    }

    if (repos.length > 0) {
        const validated: string[] = []
        for (const p of repos) {
            const abs = path.resolve(resolvedDir, p)
            if (!isWorkingCopy(abs)) {
                throw new Error(`Не является рабочей копией git: ${p}`)
            }
            validated.push(abs)
        }
        return validated.sort((a, b) => a.localeCompare(b))
    }

    if (!opts.all && !opts.interactive) {
        throw new Error('Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive')
    }

    const discovered = await findWorkingCopies(resolvedDir, opts.filter)

    if (discovered.length === 0) {
        throw new Error(`Не найдено рабочих копий в ${resolvedDir}`)
    }

    if (opts.interactive) {
        const selected = await promptWorkspaceSelection(discovered, resolvedDir)
        if (selected.length === 0) {
            throw new Error('Не выбрано ни одной рабочей копии')
        }
        return selected.sort((a, b) => a.localeCompare(b))
    }

    return discovered
}
