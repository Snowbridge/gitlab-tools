import * as fs from 'fs'
import * as path from 'path'
import { ProjectDTO } from '../../../common/DTO/Project'
import yargs from 'yargs'
import { QueryAttributeExpression, ParameterExpression, QueryNameExpression, QueryPathExpression } from '../../../common/ParameterExpression'

export default (yargs: yargs.Argv, makeHidden = false) => {
    return yargs
        .options({
            q: {
                type: 'string',
                array: true,
                alias: ['query', 'query-attribute'],
                desc: [
                    'Критерии отбора реп по родным атрибутам гитлаба, обрабатывается самим гитлабом в запросе GET /projects',
                    'доступные для отбора переамеры перечислены тут: https://docs.gitlab.com/ee/api/projects.html#list-all-projects',
                    'Доступно сравнение только на строгое равенство \`=\`',
                    '-q archived=false topic=tag-one,tag-two',
                    '--query id_after=400 id_before=800',
                    '--query-attribute search=some+te:xt+wi\\th+spaces+substituded+by+pluses',
                ].join('\n\t'),
                hidden: makeHidden,
                coerce: (argv: string[]) => argv.map(it => new QueryAttributeExpression(it))
            },
            qp: {
                desc: [
                    'Строка поиска по полному имени (case sensitive). Для выбора всех словарей `--qp main/dictionary`',
                    'Значение параметра может быть регэкспом, то есть `--qp dictionar.*` соберет и \'dictionary\', и \'dictionaries\' ',
                    'Можно задать несколько значений, они будут объединены по ИЛИ `--qp f(oo)+ --qp b.r` вернет `foo foooo foot bar birth`'
                ].join('\n\t'),
                alias: ['query-path'],
                array: true,
                hidden: makeHidden,
                coerce: (argv: string[]) => argv.map(it => new QueryPathExpression(it))
            },
            qn: {
                desc: [
                    'Отбор по полным именам или id репозиториев. Можно несколько, можно вперемешку id и path_with_namespace.',
                    'Репы отбираются по точному соответсвию id или полного пути (path_with_namespace). Если нужен сабстринг, то используй --qa search=sub/string',
                    'Можно передать имя существующего в файловой системе файла, тогда id будут вычитаны из него.',
                    'Файлы понимает двух форматов:',
                    '1. plaintext: каждая строка файла - это отдельный id проекта',
                    '2. json-массив объектов, у которых есть поле path: тогда в качествет id будут использованы вот эти path',
                    'json-массив объектов позволяет использовать выхлоп команды `report -o json` в качестве источника для списка реп к обработке.'
                ].join('\n\t'),
                array: true,
                hidden: makeHidden,
                alias: ['query-name'],
                coerce: coerceParameterQueryNames
            }
        })
        .middleware(collectAllQueryExpressions, false)
        .hide('token')
        .hide('host')
        .hide('port')
        .hide('version')
        .hide('help')
        .hide('show-hidden')
        .showHidden('show-hidden', 'Show hidden options');
}

function coerceParameterQueryNames(argv: string[]) {

    const fileName = argv[0] // если передано имя файла, то нужно заполнить массив argv из этого файла

    if (!fileName || !fs.existsSync(fileName))
        return argv.map(it => new QueryNameExpression(`${it}`))

    const fileContent = fs.readFileSync(fileName, 'utf-8')

    if (path.extname(fileName).toLowerCase() != '.json')
        return fileContent
            .split(/\r{0,1}\n/)
            .map(line => new QueryNameExpression(line))

    const jsonArray = JSON.parse(fileContent)
    if (!Array.isArray(jsonArray))
        throw Error(`Не корректный формат файла ${fileContent}: файл должен содержать json-массив`)

    if (!Object.hasOwn(jsonArray, 'path_with_namespace'))
        throw Error(`Не корректный формат файла ${fileContent}: файл должен содержать объекты, у которых есть поле path_with_namespace`)

    return jsonArray.map((it: ProjectDTO) => new QueryNameExpression(it.path_with_namespace))

}

function collectAllQueryExpressions(argv: any): void {
    const expressions = new Array<ParameterExpression>();

    [
        argv.q,
        argv.qn,
        argv.qp
    ].forEach(it => { if (Array.isArray(it)) expressions.push(...it) })

    argv.expressions = expressions
}