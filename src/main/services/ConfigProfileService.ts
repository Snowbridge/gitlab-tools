import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const configDir = path.join(os.homedir(), '.config', 'gitlab-tools')

export const profilePointerPath = path.join(configDir, 'profile')

export function profileFilePath(profileName: string): string {
    return path.join(configDir, `${profileName}.conf`)
}

export function ensureConfigDir(): void {
    fs.mkdirSync(configDir, { recursive: true })
}

export function readActiveProfileName(): string | undefined {
    try {
        if (!fs.existsSync(profilePointerPath))
            return undefined
        const s = fs.readFileSync(profilePointerPath, 'utf8').trim()
        return s.length > 0 ? s : undefined
    } catch {
        return undefined
    }
}

export function writeActiveProfileName(name: string): void {
    ensureConfigDir()
    fs.writeFileSync(profilePointerPath, `${name}\n`, 'utf8')
}

export function clearActiveProfilePointer(): void {
    try {
        if (fs.existsSync(profilePointerPath))
            fs.unlinkSync(profilePointerPath)
    } catch {
        /* ignore */
    }
}

export function listProfileNames(): string[] {
    try {
        if (!fs.existsSync(configDir))
            return []
        return fs
            .readdirSync(configDir)
            .filter((f) => f.endsWith('.conf'))
            .map((f) => f.slice(0, -'.conf'.length))
            .sort()
    } catch {
        return []
    }
}

const CONFIG_KEYS = ['GITLAB_HOST', 'GITLAB_TOKEN'] as const

export type ProfileActionResult =
    | { ok: true; stdout?: string[]; stderr?: string[]; editorExitCode?: number }
    | { ok: false; exitCode: number; stderr: string }

export class GitlabToolsProfileConfigService {
    /** Имя активного профиля и содержимое файла конфигурации (*.conf). */
    showActiveProfileAndConfig(): ProfileActionResult {
        const name = readActiveProfileName()
        const stdout: string[] = []
        if (!name) {
            stdout.push('Текущий профиль не выбран (файл profile отсутствует или пуст).')
            return { ok: true, stdout }
        }
        stdout.push(`Текущий профиль: ${name}`)
        const filePath = profileFilePath(name)
        if (!fs.existsSync(filePath)) {
            stdout.push(`Файл конфигурации не найден: ${filePath}`)
            return { ok: true, stdout }
        }
        const body = fs.readFileSync(filePath, 'utf8')
        stdout.push(body.trimEnd())
        return { ok: true, stdout }
    }

    listProfiles(): ProfileActionResult {
        const active = readActiveProfileName()
        const names = listProfileNames()
        const stdout: string[] = []
        const stderr: string[] = []
        if (names.length === 0) {
            stdout.push(`(профилей нет в ${configDir})`)
            return { ok: true, stdout }
        }
        for (const name of names) {
            const mark = active === name ? ' *' : ''
            stdout.push(`${name}${mark}`)
        }
        if (active && !names.includes(active))
            stderr.push(`Предупреждение: в profile указан "${active}", но файла ${active}.conf нет.`)
        return { ok: true, stdout, stderr: stderr.length ? stderr : undefined }
    }

    useProfile(name: string): ProfileActionResult {
        if (!isSafeProfileName(name))
            return { ok: false, exitCode: 1, stderr: 'Недопустимое имя профиля.' }
        const file = profileFilePath(name)
        if (!fs.existsSync(file))
            return { ok: false, exitCode: 1, stderr: `Профиль не найден: ${file}` }
        writeActiveProfileName(name)
        return { ok: true, stdout: [`Текущий профиль: ${name}`] }
    }

    createProfile(name: string, force: boolean): ProfileActionResult {
        if (!isSafeProfileName(name))
            return { ok: false, exitCode: 1, stderr: 'Недопустимое имя профиля.' }
        const dest = profileFilePath(name)
        if (fs.existsSync(dest) && !force)
            return {
                ok: false,
                exitCode: 1,
                stderr: `Файл уже существует: ${dest} (используйте --force)`,
            }
        ensureConfigDir()
        const lines: string[] = []
        for (const key of CONFIG_KEYS) {
            const v = process.env[key]
            if (v !== undefined && v !== '')
                lines.push(`${key}=${v}`)
        }
        if (lines.length === 0)
            return {
                ok: false,
                exitCode: 1,
                stderr: 'Нет значений GITLAB_HOST / GITLAB_TOKEN в окружении.',
            }
        fs.writeFileSync(dest, `${lines.join('\n')}\n`, 'utf8')
        return { ok: true, stdout: [`Записано: ${dest}`] }
    }

    editProfile(profileName?: string): ProfileActionResult {
        let name = profileName
        if (!name) {
            name = readActiveProfileName()
            if (!name)
                return {
                    ok: false,
                    exitCode: 1,
                    stderr: 'Не указан профиль и файл profile пуст или отсутствует.',
                }
        }
        if (!isSafeProfileName(name))
            return { ok: false, exitCode: 1, stderr: 'Недопустимое имя профиля.' }
        const filePath = profileFilePath(name)
        if (!fs.existsSync(filePath))
            return { ok: false, exitCode: 1, stderr: `Файл профиля не найден: ${filePath}` }
        const editor = process.env.EDITOR || 'nano'
        const result = spawnSync(editor, [filePath], { stdio: 'inherit' })
        if (result.error)
            return { ok: false, exitCode: 1, stderr: result.error.message }
        if (result.status !== null && result.status !== 0)
            return { ok: true, editorExitCode: result.status }
        return { ok: true }
    }

    removeProfile(name: string): ProfileActionResult {
        if (!isSafeProfileName(name))
            return { ok: false, exitCode: 1, stderr: 'Недопустимое имя профиля.' }
        const filePath = profileFilePath(name)
        if (!fs.existsSync(filePath))
            return { ok: false, exitCode: 1, stderr: `Профиль не найден: ${filePath}` }
        fs.unlinkSync(filePath)
        const stdout: string[] = [`Удалено: ${filePath}`]
        const active = readActiveProfileName()
        if (active === name) {
            clearActiveProfilePointer()
            stdout.push('Текущий профиль сброшен (файл profile удалён).')
        }
        return { ok: true, stdout }
    }
}

function isSafeProfileName(name: string): boolean {
    if (name.length === 0 || name === '.' || name === '..')
        return false
    return !/[\\/]/.test(name)
}
