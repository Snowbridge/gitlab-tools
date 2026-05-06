import yargs from 'yargs'
import QueryOptions from '../common/QueryOptions';
import { ProjectsExtractor } from '../../../services/ProjectsExtractor';
import { GitlabApi } from '../../clients/gitlab/Client';
import { Reporter } from '../../../services/Reporter';
import { ProjectDTO } from '../../../common/DTO/Project';

export const command = 'remove <topics>'

export const describe = 'Удалить топики из отобранных репозиториев'

export const aliases = ['-', 'rm'];

export const builder = (yargs: yargs.Argv) => {
    return QueryOptions(yargs, true)
    .positional('topics', {
        type: 'string',
        array: true,
        desc: 'Топики, которые нужно удалить из отобранных репозиториев. Можно передать несколько топиков через запятую.',
        coerce: (argv: string) => {
            return argv.split(',')
        }
    })
    .example([
        ['$0 topics remove team:Foo,project:Bar --q topic=team:Foo,project:Bar', 'Удалить топики team:Foo и project:Bar из репозиториев, у которых такие топики уже есть'],
    ])
}

export const handler = async function (argv: any) {
    const extractor = new ProjectsExtractor(argv.expressions, new GitlabApi(`${argv.host}:${argv.port}`, argv.token))
    extractor.extract()
        .then((result: ProjectDTO[]) => {
            throw new Error('Not implemented');
        })

}