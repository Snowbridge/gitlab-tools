import * as path from 'path'
import yargs from 'yargs'
import { GitlabApi } from '../../clients/gitlab/Client'
import { computePublishTarget, ExistingRemoteBehaviour, GitPublisher } from '../../../services/Publisher'
import { ProcessGitRemoteExecutor } from '../../../services/ProcessGitRemoteExecutor'
import { resolveWorkspaceCopies } from '../../../services/Workspace'

export const command = 'publish'

export const describe = 'Опубликовать репы в GitLab'

export const aliases = ['pub']

const DETAILED_DESCRIPTION = [
    'Публикует локальные рабочие копии в GitLab. Рабочие копии передаются через --repos/-r (наследуется от workspace);',
    'если копий нет — требуется --all или --interactive (подбор через resolveWorkspaceCopies относительно --dir).',
    'Параметр --dir у команды удалён — используется общий workspace --dir (дефолт CWD).',
    'Если публикуется одна репа без вложенности, --root-group опционален (личные проекты);',
    'если несколько реп или репа во вложенной группе — --root-group обязателен.',
    'Команда всегда пушит все ветки и теги. Опция --existing применяется, если remote с --remote-name уже существует: skip — пропустить; rename/replace — только если remote указывает на другой хост.',
    'По результату для каждой репы: ✔ 🆕 — проект создан; ✔ 📈 — push передал коммиты/теги; ✔ — без изменений.',
].join('\n')

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace publish\n\n${DETAILED_DESCRIPTION}`)
        .options({
            'root-group': {
                type: 'string',
                desc: 'Группа, в которую надо опубликовать репу (обязательна, если несколько реп или вложенность)',
            },
            'remote-name': {
                type: 'string',
                desc: 'Имя, которое надо дать remote-url для публикации',
                default: 'origin',
            },
            existing: {
                type: 'string',
                desc: 'Что делать, если remote с --remote-name уже существует: skip — пропустить; rename/replace — если remote указывает на другой хост, чем в конфиге',
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
        .check((argv) => {
            const any = argv as any
            const repos = (any.repos as string[]) ?? []
            const all = !!any.all
            const interactive = !!any.interactive
            if (all && interactive)
                throw new Error('Опции --interactive и --all не могут использоваться вместе')
            if (repos.length > 0 && (all || interactive)) {
                throw new Error('Нельзя указывать рабочие копии вместе с --all или --interactive')
            }
            if (repos.length === 0 && !all && !interactive) {
                throw new Error('Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive')
            }
            return true
        })
        .epilog(DETAILED_DESCRIPTION)
}

export const handler = async (argv: any): Promise<void> => {
    const dir: string = argv.dir ?? '.'
    const all: boolean = !!argv.all
    const interactive: boolean = !!argv.interactive
    const repos: string[] = argv.repos ?? []

    const rootGroup: string | null = argv.rootGroup ?? null
    const remoteName: string = argv.remoteName ?? 'origin'
    const existing: ExistingRemoteBehaviour = argv.existing ?? 'replace'
    const replaceSuffix: string = argv.replaceSuffix ?? '_old'
    const port: number = argv.port ?? 22

    try {
        const copies = await resolveWorkspaceCopies({
            dir,
            all,
            interactive,
            repos,
        })

        const resolvedDir = path.resolve(dir)

        const targets = copies.map((repoRoot) => {
            const rel = path.relative(resolvedDir, repoRoot)
            // если repo вне воркспейса (rel начинается с .. или абсолютный путь на другом диске), считаем одиночным проектом без вложенности
            if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
                const projectName = path.basename(repoRoot)
                if (!rootGroup) {
                    return {
                        localPath: repoRoot,
                        projectName,
                        groupSegments: [] as string[],
                        pathWithNamespace: projectName,
                        namespaceKind: 'personal' as const,
                    }
                }
                return {
                    localPath: repoRoot,
                    projectName,
                    groupSegments: [] as string[],
                    pathWithNamespace: `${rootGroup}/${projectName}`,
                    namespaceKind: 'group' as const,
                }
            }
            return computePublishTarget(resolvedDir, repoRoot, rootGroup)
        })

        if (!rootGroup) {
            const needsGroup = targets.length > 1 || targets.some((t) => t.groupSegments.length > 0)
            if (needsGroup) {
                throw new Error('Опция --root-group обязательна, если выбрано несколько рабочих копий или вложенность')
            }
        }

        const api = new GitlabApi(argv.host, argv.token)
        const git = new ProcessGitRemoteExecutor()
        const publisher = new GitPublisher(
            api,
            git,
            argv.host,
            argv.port,
            rootGroup,
            remoteName,
            existing,
            replaceSuffix,
            argv.onError,
            argv.retries,
        )

        await publisher.execute(targets)
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        console.error(message)
        process.exitCode = 1
    }
}
