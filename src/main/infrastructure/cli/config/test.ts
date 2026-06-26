import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'test [name]'

export const describe = 'Проверить подключение'

const DETAILED_DESCRIPTION = [
    'Прочитать профиль и проверить доступность GitLab API.',
    'Без аргумента — проверить активный профиль или переменные окружения.',
].join('\n')

export const builder = (y: yargs.Argv) =>
    y
        .usage(`$0 config test [name]\n\n${DETAILED_DESCRIPTION}`)
        .positional('name', {
            describe: 'Имя профиля (*.conf); без аргумента — активный профиль / окружение',
            type: 'string',
        })

export const handler = async (
    argv: yargs.ArgumentsCamelCase<{ name?: string }>,
): Promise<void> => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(await service.testConnection(argv.name))
}
