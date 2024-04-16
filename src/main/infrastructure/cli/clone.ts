import yargs from 'yargs'
import QueryOptions from './common/QueryOptions';
import { ProjectsExtractor } from '../../services/ProjectsExtractor';
import { GitlabApi } from '../clients/gitlab/Client';
import { ProjectDTO } from '../../common/DTO/Project';
import { GitCloner } from '../../services/Cloner';

export const command = 'clone'

export const describe = 'Склонировать репы, подходящие под заданные отборы. Отборы задаются точно так же, как для команды report'

export const aliases = [];

export const builder = (yargs: yargs.Argv) => {
    return QueryOptions(yargs, true)
        .options({
            directory: {
                desc: 'Каталог в файловой системе, куда склонировать все отобранные репы',
                type: 'string',
                alias: ['dir', 'd'],
                default: '.',
                group: 'Clone'
            },
            'escape-path': {
                desc: 'Флаг актуален для windows: перед созданием структуры каталогов для репозитория удалить символы, недопустимые для NTFS',
                alias: ['escape'],
                default: false,
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
                default: '--progress -v --no-rebase "origin"'
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
            'pinch-off-path': {
                type: 'string',
                desc: [
                    'Отрезать указанную строку от начала локального пути',
                    'например, `--pinch-off-path root-group/` отрежет переданную подстроку от начала локальных путей всех полученных реп',
                    'рикаких проверок на корректность итогового пути не выполняется, по этому - внимательнее со слэшами',
                    'применяется ПЕРЕД --ltrim-path'
                ].join('\n\t'),
                default: '',
                alias: ['pinch']
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
            },
            'on-fail': {
                desc: 'Что делать, если при обработке очередной репы произошло исключение',
                choices: ['skip', 'abort'],
                default: 'skip'
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
                argv.escape,
                argv.existing,
                argv.onFail,
                argv.cloneFlags,
                argv.fetchFlags,
                argv.pullFlags,
                argv.pinchOffPath
            )

            cloner.execute()
        })
}