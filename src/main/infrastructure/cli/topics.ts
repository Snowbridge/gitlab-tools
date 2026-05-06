import yargs, { string } from 'yargs'
import QueryOptions from './common/QueryOptions';
import { ProjectsExtractor } from '../../services/ProjectsExtractor';
import { GitlabApi } from '../clients/gitlab/Client';
import { ProjectDTO } from '../../common/DTO/Project';

export const command = 'topics <command> [topics]'

export const describe = 'Изменение топиков репозиториев (опции отбора репозиториев скрыты, просмотреть можно с --show-hidden)'

export const aliases = ['top', 't'];

export const builder = (yargs: yargs.Argv) => {
    return QueryOptions(yargs, true)
        .positional('command', {
            type: 'string',
            choices: ['add', 'remove', 'clear', '+', 'rm', '^'],
            desc: 'Действие над топиками',
            coerce: (argv: string) => {
                switch (argv) {
                    case '+':
                        return 'add';
                    case 'rm':
                        return 'remove';
                    case '^':
                        return 'clear';
                }
                return argv;
            }
        })
        .positional('topics', {
            type: 'string',
            array: true,
            desc: 'Топики, которые нужно добавить или удалить. Можно передать несколько топиков через запятую. Для очистки список пустой.',
            coerce: (argv: string) => {
                return argv.split(',')
            },
            demandOption: false

        })
        .check((argv) => {
            if (!argv.topics && argv.command !== 'clear') {
                return `Топики не могут быть пустыми для команды ${argv.command}`;
            }
            if (argv.command === 'clear' && argv.topics) {
                return `Команда clear не может иметь топиков`;
            }
            return true;
        })
        .example([
            ['$0 topics add team:Foo,project:Bar --query-name projects.json --q topic=team:Alpha', 'Добавить топики team:Foo и project:Bar к репозиториям, у которых уже есть топик team:Alpha, и которые перечислены в projects.json'],
            ['$0 topics remove team:Foo,project:Bar --q topic=team:Foo,project:Bar', 'Удалить топики team:Foo и project:Bar из репозиториев, у которых такие топики уже есть'],
            ['$0 topics clear --q archived=false', 'Очистить топики во всех не заархивированных репозиториях'],
        ])
}

export const handler = async function (argv: any) {
    const gitlabApi = new GitlabApi(`${argv.host}:${argv.port}`, argv.token);
    const extractor = new ProjectsExtractor(argv.expressions, gitlabApi)
    extractor.extract()
        .then(async (result: ProjectDTO[]) => {
            for (let project of result) {
                let shouldUpdateTopics = false;
                switch (argv.command) {
                    case 'add':
                        let topics = argv.topics.filter((topic: string) => !project.topics.includes(topic));
                        if (topics.length) {
                            project.topics.push(...topics);
                            shouldUpdateTopics = true;
                        }
                        break;
                    case 'remove':
                        if (project.topics.length) {
                            project.topics = project.topics.filter((topic: string) => {
                                if (argv.topics.includes(topic)) {
                                    shouldUpdateTopics = true;
                                    return false;
                                }
                                return true
                            })
                        }
                        break;
                    case 'clear':
                        if (project.topics.length) {
                            shouldUpdateTopics = true;
                            project.topics = [];
                        }
                        break;
                }
                if (shouldUpdateTopics) {
                    await gitlabApi.updateProjectData(project.id, {topics: project.topics});
                }
            }
        })
}