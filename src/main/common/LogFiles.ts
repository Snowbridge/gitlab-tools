import fs from 'fs'
import path from 'path'
import os from 'os'

export const LOG_FILE_PREFIX = 'gitlab-tools-'
export const LOG_FILE_SUFFIX = '.log.json'

export function getLogDirectory(): string {
    return path.resolve(os.tmpdir())
}

export function buildLogFilePath(logFilename: string): string {
    return path.join(getLogDirectory(), `${logFilename}.json`)
}

export function isManagedLogFileName(filename: string): boolean {
    return filename.startsWith(LOG_FILE_PREFIX) && filename.endsWith(LOG_FILE_SUFFIX)
}

export function listLogFileNames(directory?: string): string[] {
    const dir = directory ?? getLogDirectory()
    return fs.readdirSync(dir)
        .filter(isManagedLogFileName)
        .sort((a, b) => b.localeCompare(a))
}

export function getMostRecentLogFileName(directory?: string): string | null {
    const files = listLogFileNames(directory)
    return files.length > 0 ? files[0] : null
}

export function resolveLogFilePath(source: string, directory?: string): string {
    const basename = path.basename(source)
    if (source !== basename)
        throw new Error(`Недопустимое имя файла лога: ${source}`)

    const dir = path.resolve(directory ?? getLogDirectory())
    const resolved = path.resolve(dir, basename)
    if (resolved !== dir && !resolved.startsWith(dir + path.sep))
        throw new Error(`Недопустимое имя файла лога: ${source}`)

    return resolved
}

export function readLogLines(filePath: string, lines?: number): string[] {
    const content = fs.readFileSync(filePath, 'utf-8')
    const allLines = content.split('\n')
    if (lines === undefined)
        return allLines
    if (lines <= 0)
        return []
    return allLines.slice(-lines)
}
