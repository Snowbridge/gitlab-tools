import yargs from 'yargs'
import QueryOptions from './common/QueryOptions';
import { QUERY_SELECTION_DESCRIPTION } from './common/helpTexts';
import { ProjectsExtractor } from '../../services/ProjectsExtractor';
import { GitlabApi } from '../clients/gitlab/Client';
import { ProjectDTO } from '../../common/DTO/Project';
import { GitCloner } from '../../services/Cloner';

export const command = 'clone'

export const describe = 'Склонировать репозитории по отборам'

const DETAILED_DESCRIPTION = [
    'Склонировать репозитории, подходящие под заданные отборы. Отборы задаются так же, как для команды report.',
    QUERY_SELECTION_DESCRIPTION,
    'Целевой каталог задаётся опцией --dir (по умолчанию текущий).',
    'Если репозиторий уже склонирован, поведение задаётся --existing: skip — пропустить; drop — удалить и клонировать заново; fetch — git fetch; pull — git pull.',
    'Опции --ltrim-path и --resume-from управляют локальной структурой каталогов и порядком обработки.',
].join('\n')

export const aliases = [];

export const builder = (yargs: yargs.Argv) => {
    return QueryOptions(yargs.usage(`$0 clone\n\n${DETAILED_DESCRIPTION}`), true)
        .options({
            directory: {
                desc: 'Каталог в файловой системе, куда склонировать все отобранные репы',
                type: 'string',
                alias: ['dir', 'd'],
                default: '.',
                group: 'Clone'
            },
            'existing': {
                desc: [
                    'Что делать, если репа уже склонирована',
                    'skip - пропустить репу',
                    'drop - удалить клон и склонировать заново',
                    'fetch - выполнить `git fetch --all --prune --force`',
                    'pull - выполнить `pull --progress -v --no-rebase \"origin\"`'
                ].join('\n\t'),
                choices: [
                    'skip', 'drop', 'fetch', 'pull'
                ],
                default: 'skip',
                group: 'Clone'
            },
            'clone-flags': {
                desc: [
                    `Сюда можно передать флаги, которые будут переданы в 'git clone'`,
                    `Значение параметра передается так: --clone-flags="--one val123 -t -w -o --three"`
                ].join('\n\t'),
                type: 'string'
            },
            'fetch-flags': {
                desc: [
                    `Сюда можно передать флаги, которые будут переданы в 'git fetch'`,
                    `Значение параметра передается так: --fetch-flags="--one val123 -t -w -o --three"`
                ].join('\n\t'),
                type: 'string',
                default: '--all --prune --force'
            },
            'pull-flags': {
                desc: [
                    `Сюда можно передать флаги, которые будут переданы в 'git pull'`,
                    `Значение параметра передается так: --pull-flags="--one val123 -t -w -o --three"`
                ].join('\n\t'),
                type: 'string',
                default: '--progress -v --no-rebase'
            },
            'ltrim-path': {
                type: 'number',
                default: 0,
                desc: [
                    'Отрезать указанное количество групп слева от локального пути',
                    '\tПолезно, когда мы клонируем в локальный каталог, в котором уже есть аналогичная структура,',
                    'то есть, без --ltrim-path 2 следующая команда `$0 clone --dir ./root-group/tracking --path root-group/tracking/ --ltrim-path 2` ',
                    'создаст дополнительные подкаталоги `root-group/tracking` внутри целевой папки, что не всегда нужно',
                    '\tNB! У этого параметра нет мозгов. Если в результате его применения случайно совпадут локальные пути у двух разных реп,',
                    'то это будет считаться одной и той же репой и к ней будет применено поведение --existing',
                    'применяется ПОСЛЕ --pinch-off-path',
                ].join('\n\t'),
                alias: ['trim']
            },
            'resume-from': {
                desc: [
                    'Репы перед обработкой сортируются по path, этот параметр позволяет начать не с самой первой репы, а с указанной',
                    'Значение - либо path, либо целочисленный id проекта',
                    'Параметр чувствителен к регистру и сравнение происходит по простому =='
                ].join('\n\t'),
                type: 'string',
                alias: ['resume']
            },
            port: {
                type: 'number',
                default: 22,
                desc: 'TCP-порт, на котором гитлаб ждёт SSH-подключений',
            }
        })
}

export const handler = async function (argv: any) {
    const extractor = new ProjectsExtractor(argv.expressions, new GitlabApi(argv.host, argv.token))
    extractor.extract()
        .then((projects: ProjectDTO[]) => {
            const cloner = new GitCloner(
                `${argv.host}:${argv.port}`,
                projects,
                argv.directory,
                argv.ltrimPath,
                argv.existing,
                argv.onError,
                argv.retries,
                argv.cloneFlags,
                argv.fetchFlags,
                argv.pullFlags
            )

            cloner.execute()
        })
}
