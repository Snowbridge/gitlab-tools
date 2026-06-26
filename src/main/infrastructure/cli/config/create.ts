import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'create <name>'

export const describe = 'Создать профиль'

const DETAILED_DESCRIPTION = [
    'Записать GITLAB_HOST и GITLAB_TOKEN из текущего окружения в файл <name>.conf.',
    'Опция --force перезаписывает существующий профиль.',
].join('\n')

export const builder = (y: yargs.Argv) =>
    y
        .usage(`$0 config create <name>\n\n${DETAILED_DESCRIPTION}`)
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
