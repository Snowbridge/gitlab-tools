import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'remove <name>'

export const describe = 'Удалить файл профиля'

export const builder = (y: yargs.Argv) =>
    y.positional('name', {
        describe: 'Имя профиля',
        type: 'string',
        demandOption: true,
    })

export const handler = (argv: yargs.ArgumentsCamelCase<{ name: string }>): void => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.removeProfile(argv.name))
}
