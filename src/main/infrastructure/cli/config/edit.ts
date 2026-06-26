import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'edit [name]'

export const describe = 'Редактировать профиль'

const DETAILED_DESCRIPTION = [
    'Открыть файл профиля в $EDITOR или nano.',
    'Без аргумента — редактировать активный профиль из файла profile.',
].join('\n')

export const builder = (y: yargs.Argv) =>
    y
        .usage(`$0 config edit [name]\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', {
            describe: 'Профиль (по умолчанию — текущий из profile)',
            type: 'string',
        })

export const handler = (argv: yargs.ArgumentsCamelCase<{ name?: string }>): void => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.editProfile(argv.name))
}
