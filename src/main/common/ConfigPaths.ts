import fs from 'fs'
import os from 'os'
import path from 'path'

export const configDir = path.join(os.homedir(), '.config', 'gitlab-tools')

export const profilePointerPath = path.join(configDir, 'profile')

export function profileFilePath(profileName: string): string {
    return path.join(configDir, `${profileName}.conf`)
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
