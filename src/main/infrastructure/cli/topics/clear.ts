import yargs from 'yargs'
import QueryOptions from '../common/QueryOptions';
import { ProjectsExtractor } from '../../../services/ProjectsExtractor';
import { GitlabApi } from '../../clients/gitlab/Client';
import { Reporter } from '../../../services/Reporter';
import { ProjectDTO } from '../../../common/DTO/Project';

export const command = 'clear'

export const describe = 'Очистить топики в отобранных репозиториях'

export const aliases = ['--', 'clr'];

export const builder = (yargs: yargs.Argv) => {
    return QueryOptions(yargs, true)
    .example([
        ['$0 topics clear --q archived=false', 'Очистить топики во всех не заархивированных репозиториях'],
    ])
}

export const handler = async function (argv: any) {
    console.log(argv.sourceTopics);
    console.log(argv.targetTopics);
    const extractor = new ProjectsExtractor(argv.expressions, new GitlabApi(`${argv.host}:${argv.port}`, argv.token))
    extractor.extract()
        .then((result: ProjectDTO[]) => {
            throw new Error('Not implemented');
        })
}