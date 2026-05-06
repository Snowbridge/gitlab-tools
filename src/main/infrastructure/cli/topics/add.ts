import yargs from 'yargs'
import QueryOptions from '../common/QueryOptions';
import { ProjectsExtractor } from '../../../services/ProjectsExtractor';
import { GitlabApi } from '../../clients/gitlab/Client';
import { Reporter } from '../../../services/Reporter';
import { ProjectDTO } from '../../../common/DTO/Project';

export const command = 'add <topics>'

export const describe = 'Добавить топики к отобранным репозиториям'

export const aliases = ['+', 'a'];

export const builder = (yargs: yargs.Argv) => {
    return QueryOptions(yargs, true)
        .positional('topics', {
            type: 'string',
            array: true,
            desc: 'Топики, которые нужно добавить к отобранным репозиториям. Можно передать несколько топиков через запятую.',
            coerce: (argv: string) => {
                return argv.split(',')
            }
        })
        .example([
            ['$0 topics add team:Foo,project:Bar --query-name projects.json --q topic=team:Alpha', 'Добавить топики team:Foo и project:Bar к репозиториям, у которых уже есть топик team:Alpha, и которые перечислены в projects.json'],
        ])
}

export const handler = async function (argv: any) {
    const extractor = new ProjectsExtractor(argv.expressions, new GitlabApi(`${argv.host}:${argv.port}`, argv.token))
    extractor.extract()
        .then((result: ProjectDTO[]) => {
            throw new Error('Not implemented');
        })
}