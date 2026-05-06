import yargs from 'yargs'
import QueryOptions from './common/QueryOptions';
import { ProjectsExtractor } from '../../services/ProjectsExtractor';
import { GitlabApi } from '../clients/gitlab/Client';
import { Reporter } from '../../services/Reporter';
import { ProjectDTO } from '../../common/DTO/Project';

export const command = 'topics'

export const describe = 'Изменение топиков репозиториев (опции отбора репозиториев скрыты, просмотреть можно с --show-hidden)'

export const aliases = ['top', 't'];

export const builder = (yargs: yargs.Argv) => {
    return yargs
        .commandDir('topics')
}

export const handler = async function (argv: any) {
    throw new Error('Not implemented');
    const extractor = new ProjectsExtractor(argv.expressions, new GitlabApi(`${argv.host}:${argv.port}`, argv.token))
    extractor.extract()
        .then((result: ProjectDTO[]) => {
            let reporter = new Reporter(result, argv.output)
            reporter.generateReport()
        })
}