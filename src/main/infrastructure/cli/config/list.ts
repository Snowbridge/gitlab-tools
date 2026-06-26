import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'list'

export const describe = 'Список профилей'

const DETAILED_DESCRIPTION = 'Показать имена всех профилей (файлы *.conf) в каталоге ~/.config/gitlab-tools/.'

export const builder = (y: yargs.Argv) =>
    y.usage(`$0 config list\n\n${DETAILED_DESCRIPTION}`)

export const handler = (): void => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.listProfiles())
}
