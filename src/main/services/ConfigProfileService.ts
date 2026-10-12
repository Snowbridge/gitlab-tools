import { spawnSync } from 'child_process'
import fs from 'fs'
import {
    configDir,
    profileFilePath,
    profilePointerPath,
    readActiveProfileName,
} from '../common/ConfigPaths'
import {
    buildNewProfileTemplate,
    loadProfileFromPath,
    maskProfileBodyForDisplay,
    rawToRuntime,
} from '../common/ProfileConfig'
import { GitlabApi } from '../infrastructure/clients/gitlab/Client'

export {
    configDir,
    profileFilePath,
    readActiveProfileName,
} from '../common/ConfigPaths'

export function ensureConfigDir(): void {
    fs.mkdirSync(configDir, { recursive: true })
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

export type ProfileActionResult =
    | { ok: true; stdout?: string[]; stderr?: string[]; editorExitCode?: number }
    | { ok: false; exitCode: number; stderr: string }

export class GitlabToolsProfileConfigService {
    showActiveProfileAndConfig(unmasked = false): ProfileActionResult {
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
        stdout.push(maskProfileBodyForDisplay(body, unmasked))
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
        fs.writeFileSync(dest, buildNewProfileTemplate(), 'utf8')
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

    async testConnection(profileName?: string): Promise<ProfileActionResult> {
        let profileLabel: string
        let filePath: string

        if (profileName !== undefined) {
            if (!isSafeProfileName(profileName))
                return { ok: false, exitCode: 1, stderr: 'Недопустимое имя профиля.' }
            filePath = profileFilePath(profileName)
            profileLabel = profileName
        } else {
            const active = readActiveProfileName()
            if (!active)
                return {
                    ok: false,
                    exitCode: 1,
                    stderr: 'Не выбран активный профиль (файл profile).',
                }
            filePath = profileFilePath(active)
            profileLabel = active
        }

        if (!fs.existsSync(filePath))
            return { ok: false, exitCode: 1, stderr: `Профиль не найден: ${filePath}` }

        const raw = loadProfileFromPath(filePath)
        const cfg = rawToRuntime(raw ?? {})
        if (!cfg.host || !cfg.token)
            return {
                ok: false,
                exitCode: 1,
                stderr: 'В профиле не заданы HOST и/или TOKEN.',
            }

        try {
            const api = new GitlabApi(`${cfg.host}:${cfg.port}`, cfg.token)
            const pages = await api.testConnection()
            return {
                ok: true,
                stdout: [
                    `Конфигурация корректна, GitLab доступен (профиль: ${profileLabel}).`,
                    `Страниц в выборке /projects: ${pages}.`,
                ],
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            return { ok: false, exitCode: 1, stderr: message }
        }
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
