import yargs from 'yargs'
import YAML from 'yaml'
import QueryOptions from './common/QueryOptions';
import { ProjectsExtractor } from '../../services/ProjectsExtractor';
import { GitlabApi } from '../clients/gitlab/Client';
import { Reporter } from '../../services/Reporter';
import { ProjectDTO } from '../../common/DTO/Project';
import { ParameterExpression, UpdateMetadataArrayClearExpression, UpdateMetadataArrayPushExpression, UpdateMetadataArrayRemoveExpression, UpdateMetadataDropKeyExpression, UpdateMetadataKeyExpression, UpdateMetadataModelExpression } from '../../common/ParameterExpression';
import { Updater } from '../../services/Updater';


export const command = 'update'

export const describe = 'Обновление YAML-метаданных в гитлабе'

export const aliases = [];

export const builder = (yargs: yargs.Argv) => {
    return QueryOptions(yargs, true)
        .options({
            set: {
                desc: [
                    'Установить скалярное значение ключа. Если до выполнения команды ключ хранил массив, то после выполнения он станет скаляром.',
                ].join('\n\t'),
                array: true,
                alias: ['set-key', 'k'],
                coerce: (argv: string[]) => argv.map(it => new UpdateMetadataKeyExpression(it))
            },
            model: {
                type: 'string',
                desc: [
                    'Заменить все метаданные содержимым файла, при этом текст до `---` в описании репы останется не измененным',
                    '--model - единствекнный параметр, который нельзя комбинировать с остальными',
                    'Если передать пустой файл, то YAML-метаданные будут полностью удалены из описаний репозиториев'
                ].join('\n\t'),
                coerce: argv => {
                    const parameter = new UpdateMetadataModelExpression(argv)
                    const content = parameter.getRightValue()

                    try {
                        if (content != "")
                            parameter.setValue(YAML.parse(content))
                    } catch (error) {
                        throw Error(`Не корректный формат файла модели, ошибка ${error}`)
                    }

                    return parameter
                },
                conflicts: ['set', 'push', 'remove', 'clear', 'drop']
            },
            push: {
                desc: 'Добавить значение в массив, перед добавлением проверяет на дубли',
                array: true,
                coerce: (argv: string[]) => argv.map(it => new UpdateMetadataArrayPushExpression(it))
            },
            remove: {
                desc: 'Удалить значение из массива, если значения в массие нет, то ничего не делает',
                array: true,
                coerce: (argv: string[]) => argv.map(it => new UpdateMetadataArrayRemoveExpression(it))
            },
            clear: {
                desc: 'Очистить массив. Если значение не является массивом, то ничего не делает',
                array: true,
                coerce: (argv: string[]) => argv.map(it => new UpdateMetadataArrayClearExpression(it))
            },
            drop: {
                desc: 'Удалить ключ из метаданных полностью, если такого ключа нет, то ничего не делает',
                array: true,
                coerce: (argv: string[]) => argv.map(it => new UpdateMetadataDropKeyExpression(it))
            },
            dry: {
                desc: 'Только вывести отчет о предстоящих изменениях без выполнения самих изменений',
                alias: ['dry-run']
            }

        })
        .middleware(parseExpressions, false)
        .example('$0 update --set-key path.to.metadata.key=value -k path.to.metadata.another-key=value+pluces+will+be+replaced+with+spaces', 'Установить значения отдельных ключей')
        .example('$0 update --model ./path/to/will-replace-all-metadata-with-this-file.yaml', 'Заменить метаданные полностью на содержимое файла')
        .example('$0 update --push path.to.array@insert-value -p path.to.array@pluses+will+be+replaced+with+spaces', 'Вставить значение в массив')
        .example('$0 update --remove path.to.array@remove-value -r path.to.array@value-to-be-removed', 'Удалить значение из массива')
        .example('$0 update --clear path.to.key-to-be-set-empty', 'Очистить значение ключа или удалить все элементы массива')
        .example('$0 update --drop path.to.key-to-be-removed-from-metadata-object', 'Удалить ключ из метаданных полностью')
        .epilogue([
            'Параметры можно комбинировать, то есть одновременно и --set-key, и --drop, и что угодно, кроме --model,',
            'Порядок выполнения команд соответствует тому порядку, в котором они заданы в командной строке.',
            'Символ \'+\' в значениях параметров будут заменен на пробелы'
        ].join('\n'))
}

function parseExpressions(argv: any): void {

    const expressions = new Array<ParameterExpression>();

    [
        argv.setKey,
        argv.push,
        argv.remove,
        argv.clear,
        argv.drop
    ].forEach(it => { if (Array.isArray(it)) expressions.push(...it) })

    if (argv.model)
        expressions.push(argv.model)

    argv.updateExpressions = expressions
}

export const handler = async function (argv: any) {
    const extractor = new ProjectsExtractor(argv.expressions, new GitlabApi(`${argv.host}:${argv.port}`, argv.token))
    extractor.extract()
        .then((result: ProjectDTO[]) => {
            if (argv.dryRun)
                printReport(result)
            else
                updateProjects(result, argv.updateExpressions, argv.host, argv.token, argv.onError, argv.retries)
        })
}

function updateProjects(projects: ProjectDTO[], updateExpressions: ParameterExpression[], host: string, token: string, onError: 'skip' | 'retry' | 'abort', retries: number) {
    const updater = new Updater(
        projects,
        updateExpressions,
        new GitlabApi(host, token),
        onError,
        retries,
    ).execute()
        .then(() => { })
}

function printReport(projects: ProjectDTO[]) {
    let reporter = new Reporter(projects, 'console')
    reporter.generateReport()
}