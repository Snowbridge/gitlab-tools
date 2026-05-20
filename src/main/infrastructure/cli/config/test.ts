import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'test [name]'

export const describe = 'Проверить конфигурацию и доступность GitLab'

export const builder = (y: yargs.Argv) =>
    y.positional('name', {
        describe: 'Имя профиля (*.conf); без аргумента — активный профиль / окружение',
        type: 'string',
    })

export const handler = async (
    argv: yargs.ArgumentsCamelCase<{ name?: string }>,
): Promise<void> => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(await service.testConnection(argv.name))
}
