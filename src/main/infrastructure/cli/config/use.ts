import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'use <name>'

export const describe = 'Активировать профиль'

const DETAILED_DESCRIPTION = [
    'Записать имя профиля в файл profile.',
    'При следующем запуске утилиты dotenv подхватит соответствующий <name>.conf.',
].join('\n')

export const builder = (y: yargs.Argv) =>
    y
        .usage(`$0 config use <name>\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', {
            describe: 'Имя профиля (без .conf)',
            type: 'string',
            demandOption: true,
        })

export const handler = (argv: yargs.ArgumentsCamelCase<{ name: string }>): void => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.useProfile(argv.name))
}
