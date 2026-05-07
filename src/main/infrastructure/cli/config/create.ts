import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'create <name>'

export const describe = 'Создать профиль из текущих GITLAB_HOST и GITLAB_TOKEN'

export const builder = (y: yargs.Argv) =>
    y
        .positional('name', {
            describe: 'Имя нового профиля',
            type: 'string',
            demandOption: true,
        })
        .option('force', {
            type: 'boolean',
            default: false,
            describe: 'Перезаписать существующий файл',
        })

export const handler = (
    argv: yargs.ArgumentsCamelCase<{ name: string; force: boolean }>,
): void => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.createProfile(argv.name, argv.force))
}
