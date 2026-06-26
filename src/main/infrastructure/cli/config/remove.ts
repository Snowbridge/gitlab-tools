import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'remove <name>'

export const describe = 'Удалить профиль'

const DETAILED_DESCRIPTION = [
    'Удалить файл <name>.conf из каталога конфигурации.',
    'Указатель profile (активный профиль) не изменяется.',
].join('\n')

export const builder = (y: yargs.Argv) =>
    y
        .usage(`$0 config remove <name>\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', {
            describe: 'Имя профиля',
            type: 'string',
            demandOption: true,
        })

export const handler = (argv: yargs.ArgumentsCamelCase<{ name: string }>): void => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.removeProfile(argv.name))
}
