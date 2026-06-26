import * as fs from 'fs'
import * as path from 'path'
import yargs from 'yargs'
import { GitlabApi } from '../clients/gitlab/Client'
import { discoverPublishTargets, ExistingRemoteBehaviour, GitPublisher, isWorkingCopyRoot } from '../../services/Publisher'
import { ProcessGitRemoteExecutor } from '../../services/ProcessGitRemoteExecutor'

export const command = 'publish <dir>'

export const describe = 'Опубликовать репы в GitLab'

const DETAILED_DESCRIPTION = [
    'Для публикации репы в GitLab нужно указать каталог с рабочей копией репы или общий корень нескольких рабочих копий.',
    'Если <dir> - это рабочая копия репы, то команда создаст новый репозиторий с именем текущего каталога в личных проектах пользователя (без --root-group) или в группе --root-group',
    'Если <dir> - это общий корень нескольких рабочих копий, то команда создаст новые репозитории с именами каталогов и воссозданием структуры групп в --root-group (обязательна)',
    'Команда всегда пушит все ветки и теги. Опция --existing применяется, если remote с --remote-name уже существует: skip — пропустить рабочую копию; rename/replace — только если remote указывает на другой хост.',
].join('\n')

export const aliases = ['pub']

export const builder = (yargs: yargs.Argv) => {
    return yargs
        .usage(`$0 publish <dir>\n\n${DETAILED_DESCRIPTION}`)
        .positional('dir', {
            type: 'string',
            desc: 'Каталог с рабочей копией репы или общий корень нескольких рабочих копий (по дефолту просто корень)',
            default: '.',
        })
        .options({
            'root-group': {
                type: 'string',
                desc: 'Группа, в которую надо опубликовать репу (обязательна, если <dir> не является рабочей копией)',
            },
            'remote-name': {
                type: 'string',
                desc: 'Имя, которое надо дать remote-url для публикации',
                default: 'origin',
            },
            existing: {
                type: 'string',
                desc: 'Что делать, если remote с --remote-name уже существует: skip — пропустить рабочую копию; rename/replace — если remote указывает на другой хост, чем в конфиге',
                choices: ['rename', 'replace', 'skip'] as ExistingRemoteBehaviour[],
                default: 'replace' as ExistingRemoteBehaviour,
            },
            'replace-suffix': {
                type: 'string',
                desc: 'Суффикс, который надо добавить к имени remote-name в случае `--existing rename`',
                default: '_old',
            },
            port: {
                type: 'number',
                default: 22,
                desc: 'TCP-порт, на котором гитлаб ждёт SSH-подключений',
            },
        })
}

export const handler = async function (argv: any) {
    const dir = path.resolve(argv.dir)
    if (!fs.existsSync(dir))
        throw new Error(`Каталог не существует: ${dir}`)

    if (!isWorkingCopyRoot(dir) && !argv.rootGroup)
        throw new Error('Опция --root-group обязательна, если <dir> не является рабочей копией git')

    const rootGroup = argv.rootGroup ?? null
    const targets = discoverPublishTargets(dir, rootGroup)
    const api = new GitlabApi(argv.host, argv.token)
    const git = new ProcessGitRemoteExecutor()
    const publisher = new GitPublisher(
        api,
        git,
        argv.host,
        argv.port,
        argv.rootGroup ?? null,
        argv.remoteName,
        argv.existing,
        argv.replaceSuffix,
        argv.onError,
        argv.retries
    )

    await publisher.execute(targets)
}
