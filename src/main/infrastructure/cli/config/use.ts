import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'use <name>'

export const describe = 'Сделать профиль текущим (запись в файл profile)'

export const builder = (y: yargs.Argv) =>
    y.positional('name', {
        describe: 'Имя профиля (без .conf)',
        type: 'string',
        demandOption: true,
    })

export const handler = (argv: yargs.ArgumentsCamelCase<{ name: string }>): void => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.useProfile(argv.name))
}
