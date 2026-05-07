import yargs from 'yargs'
import { emitProfileActionResult } from '../config'
import { GitlabToolsProfileConfigService } from '../../../services/ConfigProfileService'

export const command = 'list'

export const describe = 'Показать все профили (файлы *.conf)'

export const builder = (y: yargs.Argv) => y

export const handler = (): void => {
    const service = new GitlabToolsProfileConfigService()
    emitProfileActionResult(service.listProfiles())
}
