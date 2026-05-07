import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'edit [name]'

export const describe = 'Открыть файл профиля в редакторе ($EDITOR или nano)'

export const builder = (y: yargs.Argv) =>
    y.positional('name', {
        describe: 'Профиль (по умолчанию — текущий из profile)',
        type: 'string',
    })

export const handler = (argv: yargs.ArgumentsCamelCase<{ name?: string }>): void => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.editProfile(argv.name))
}
