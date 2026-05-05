import { GitlabProjectDTO } from "../common/DTO/Gitlab/ProjectDTO";
import { GitlabApi } from "../infrastructure/clients/gitlab/Client";
import { ProjectDTO } from "../common/DTO/Project";
import { ParameterExpression } from "../common/ParameterExpression";
import ora from "ora"

export class ProjectsExtractor {
    private queryExpressions: ParameterExpression[]
    private client: GitlabApi

    constructor(queryExpressions: ParameterExpression[], client: GitlabApi) {
        this.queryExpressions = queryExpressions
        this.client = client
    }

    async extract(): Promise<ProjectDTO[]> {

        const spinner = ora('Получение списка репозиториев...').start()

        let gitProjects: GitlabProjectDTO[] = await this.client.getProjects(this.queryExpressions)

        let pathsFilters = this.queryExpressions.filter(it => it.getType() == 'QueryPathExpression')

        if (pathsFilters.length) // если задан фильтр по пути, то выкинуть всех, кто в фильтр не попал
            gitProjects = gitProjects.filter((repo: { path_with_namespace: string }) =>
                pathsFilters.some(expr => new RegExp(expr.getRightValue()).test(repo.path_with_namespace)))

        spinner.succeed(`Получено ${gitProjects.length} репозиториев`)

        return gitProjects
    }
}
