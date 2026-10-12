import yargs from 'yargs'
import { formatProfileKeysForHelp } from '../../common/ProfileConfig'
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

export const describe = 'Управление профилями конфигурации'

const DETAILED_DESCRIPTION = [
    'Профили хранятся в ~/.config/gitlab-tools/ как файлы <name>.conf (формат dotenv).',
    'Активный профиль указывается в файле profile; при старте утилиты читается соответствующий .conf.',
    'Без подкоманды — показать активный профиль и его содержимое. Опция --unmasked выводит TOKEN без маскировки.',
    '',
    'Ключи в файле профиля:',
    formatProfileKeysForHelp(),
].join('\n')

export const builder = (yargs: yargs.Argv) => {
    return yargs
        .epilog(DETAILED_DESCRIPTION)
        .option('unmasked', {
            type: 'boolean',
            default: false,
            describe: 'Показать TOKEN без маскировки (по умолчанию токен скрыт)',
        })
        .commandDir('config')
}

export const handler = (
    argv: yargs.ArgumentsCamelCase<{ unmasked?: boolean }>,
): void => {
    if (argv._.length > 1)
        return
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.showActiveProfileAndConfig(!!argv.unmasked))
}
