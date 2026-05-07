import yargs from 'yargs'
import {
    GitlabToolsProfileConfigService,
    type ProfileActionResult,
} from '../../services/ConfigProfileService'

export function emitProfileActionResult(r: ProfileActionResult): void {
    if (!r.ok) {
        console.error(r.stderr)
        process.exitCode = r.exitCode
        return
    }
    r.stdout?.forEach((line) => console.log(line))
    r.stderr?.forEach((line) => console.error(line))
    if (r.editorExitCode !== undefined && r.editorExitCode !== 0)
        process.exitCode = r.editorExitCode
}

export const command = 'config'

export const describe = 'Управление конфигурацией утилиты в ~/.config/gitlab-tools/'

export const builder = (yargs: yargs.Argv) => {
    return yargs.commandDir('config')
}

export const handler = (argv: yargs.Arguments): void => {
    if (argv._.length > 1)
        return
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.showActiveProfileAndConfig())
}
