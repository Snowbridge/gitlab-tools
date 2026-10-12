import fs from 'fs'
import { profileFilePath, readActiveProfileName } from './ConfigPaths'

export type OnErrorChoice = 'retry' | 'abort' | 'skip'

export type ProfileConfigKeyDef = {
    key: string
    required: boolean
    description: string
    defaultValue?: string
}

export const PROFILE_CONFIG_KEY_DEFS: ProfileConfigKeyDef[] = [
    {
        key: 'HOST',
        required: true,
        description: 'хост GitLab API (без схемы и порта)',
    },
    {
        key: 'TOKEN',
        required: true,
        description: 'персональный токен доступа',
    },
    {
        key: 'PORT',
        required: false,
        description: 'TCP-порт GitLab API (глобальная опция --port)',
        defaultValue: '443',
    },
    {
        key: 'ON_ERROR',
        required: false,
        description: 'поведение при ошибках REST: retry, abort, skip (--on-error)',
        defaultValue: 'retry',
    },
    {
        key: 'RETRIES',
        required: false,
        description: 'число повторов (--retries)',
        defaultValue: '3',
    },
    {
        key: 'LOG_FILENAME',
        required: false,
        description: 'имя JSON-лога в каталоге временных файлов (--log)',
    },
    {
        key: 'DEBUG',
        required: false,
        description: 'дублировать логи в консоль: true, 1, yes (--debug)',
    },
]

export const PROFILE_CONFIG_KEYS = PROFILE_CONFIG_KEY_DEFS.map((d) => d.key)

export type ParsedProfileRaw = Partial<Record<string, string>>

export type RuntimeConfig = {
    host?: string
    token?: string
    port: number
    onError: OnErrorChoice
    retries: number
    logFilename: string
    debug: boolean
}

const ON_ERROR_CHOICES: OnErrorChoice[] = ['retry', 'abort', 'skip']

let runtime: RuntimeConfig = defaultRuntime()

function defaultRuntime(): RuntimeConfig {
    return {
        port: 443,
        onError: 'retry',
        retries: 3,
        logFilename: defaultLogFilename(),
        debug: false,
    }
}

export function defaultLogFilename(): string {
    return `gitlab-tools-${new Date().toISOString().replaceAll(':', '-')}.log`
}

/** Строки KEY=value и # комментарии; пустые строки пропускаются. */
export function parseProfileFile(content: string): ParsedProfileRaw {
    const out: ParsedProfileRaw = {}
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.length === 0 || trimmed.startsWith('#'))
            continue
        const eq = trimmed.indexOf('=')
        if (eq <= 0)
            continue
        const key = trimmed.slice(0, eq).trim()
        const value = trimmed.slice(eq + 1).trim()
        out[key] = value
    }
    return out
}

export function parseDebugValue(value: string | undefined): boolean {
    if (value === undefined || value === '')
        return false
    const v = value.toLowerCase()
    return v === 'true' || v === '1' || v === 'yes'
}

export function parseOnError(value: string | undefined): OnErrorChoice {
    if (value && ON_ERROR_CHOICES.includes(value as OnErrorChoice))
        return value as OnErrorChoice
    return 'retry'
}

export function rawToRuntime(raw: ParsedProfileRaw, base?: RuntimeConfig): RuntimeConfig {
    const b = base ?? defaultRuntime()
    const portRaw = raw.PORT
    const retriesRaw = raw.RETRIES
    return {
        host: raw.HOST !== undefined && raw.HOST !== '' ? raw.HOST : b.host,
        token: raw.TOKEN !== undefined && raw.TOKEN !== '' ? raw.TOKEN : b.token,
        port:
            portRaw !== undefined && portRaw !== ''
                ? Number(portRaw)
                : b.port,
        onError: raw.ON_ERROR !== undefined && raw.ON_ERROR !== ''
            ? parseOnError(raw.ON_ERROR)
            : b.onError,
        retries:
            retriesRaw !== undefined && retriesRaw !== ''
                ? Number(retriesRaw)
                : b.retries,
        logFilename:
            raw.LOG_FILENAME !== undefined && raw.LOG_FILENAME !== ''
                ? raw.LOG_FILENAME
                : b.logFilename,
        debug: raw.DEBUG !== undefined && raw.DEBUG !== ''
            ? parseDebugValue(raw.DEBUG)
            : b.debug,
    }
}

export function loadProfileFromPath(filePath: string): ParsedProfileRaw | null {
    try {
        if (!fs.existsSync(filePath))
            return null
        return parseProfileFile(fs.readFileSync(filePath, 'utf8'))
    } catch {
        return null
    }
}

export function loadActiveProfileRaw(): ParsedProfileRaw | null {
    const name = readActiveProfileName()
    if (!name)
        return null
    return loadProfileFromPath(profileFilePath(name))
}

export function applyProfileRawToRuntime(raw: ParsedProfileRaw | null): void {
    if (!raw) {
        runtime = defaultRuntime()
        return
    }
    runtime = rawToRuntime(raw, defaultRuntime())
}

export function loadActiveProfileIntoRuntime(): void {
    applyProfileRawToRuntime(loadActiveProfileRaw())
}

export function getRuntimeConfig(): RuntimeConfig {
    return { ...runtime }
}

export function patchRuntimeConfig(patch: Partial<RuntimeConfig>): void {
    runtime = { ...runtime, ...patch }
}

export function buildNewProfileTemplate(): string {
    const lines: string[] = [
        '# Параметры подключения к GitLab (обязательные)',
        'HOST=',
        'TOKEN=',
        '',
        '# Необязательные (раскомментируйте при необходимости)',
    ]
    for (const def of PROFILE_CONFIG_KEY_DEFS) {
        if (def.required)
            continue
        const comment = def.defaultValue
            ? `# ${def.key}=${def.defaultValue}`
            : `# ${def.key}=`
        lines.push(comment)
    }
    return `${lines.join('\n')}\n`
}

export function formatProfileKeysForHelp(): string {
    return PROFILE_CONFIG_KEY_DEFS
        .map((d) => {
            const req = d.required ? 'обязательный' : 'необязательный'
            const def = d.defaultValue ? `, по умолчанию ${d.defaultValue}` : ''
            return `  ${d.key} (${req}) — ${d.description}${def}`
        })
        .join('\n')
}

function maskTokenForDisplay(token: string): string {
    return `${token.slice(0, 4)}********`
}

export function maskProfileBodyForDisplay(body: string, unmasked = false): string {
    if (unmasked)
        return body.trimEnd()
    return body
        .split('\n')
        .map((line) => {
            if (!line.startsWith('TOKEN='))
                return line
            const value = line.slice('TOKEN='.length)
            return `TOKEN=${maskTokenForDisplay(value)}`
        })
        .join('\n')
        .trimEnd()
}

export function escapeTokenForDisplay(token: string, left = 3, right = 2): string {
    if (token.length < left + right)
        return token[0] + new Array(token.length).join('*')
    const regex = new RegExp(`^(.{${left},${left}}).*(.{${right},${right}})$`, 'ig')
    return token.replace(regex, `$1${new Array(token.length - left - right + 1).join('*')}$2`)
}
