import yargs from 'yargs'
import QueryOptions from './common/QueryOptions';
import { ProjectsExtractor } from '../../services/ProjectsExtractor';
import { GitlabApi } from '../clients/gitlab/Client';
import { Reporter } from '../../services/Reporter';
import { ProjectDTO } from '../../common/DTO/Project';

export const command = 'report'

export const describe = 'Отчет по репозиториям'

export const aliases = ['rep', 'r'];

export const builder = (yargs: yargs.Argv) => {
    return QueryOptions(yargs, true)
        .options({
            output: {
                desc: 'Способ вывода отобранных проектов - на консоль или json-файл в текущий каталог',
                choices: ['json', 'console'],
                alias: ['o'],
                default: 'console'
            }
        })
}

export const handler = async function (argv: any) {
    const extractor = new ProjectsExtractor(argv.expressions, new GitlabApi(`${argv.host}:${argv.port}`, argv.token))
    extractor.extract()
        .then((result: ProjectDTO[]) => {
            let reporter = new Reporter(result, argv.output)
            reporter.generateReport()
        })
}