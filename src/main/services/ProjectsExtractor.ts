import { GitlabProjectDTO } from "../common/DTO/Gitlab/ProjectDTO";
import { GitlabApi } from "../infrastructure/clients/gitlab/Client";
import { ProjectDTO } from "../common/DTO/Project";
import YAML from 'yaml'
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

        let projects = convertProjects(gitProjects)

        const metadataFilters = this.queryExpressions.filter(it => it.getType() == 'QueryMetadataExpression')

        if (metadataFilters.length) { // есть фильтры по метаданным
            const jp = require('jsonpath')
            projects = projects.filter(p =>
                metadataFilters.some(exp => {
                    const result: string[] = jp.query(p.yamlMetadata.content, exp.getLeftValue())
                    if(!result.length)
                        return false

                    const includes = result.includes(exp.getRightValue())
                    return exp.getOperator() == '!=' ? !includes : includes
                })
            )
        }
    
        spinner.succeed(`Получено ${projects.length} репозиториев`)

        return projects
    }
}

function convertProjects(giltabProjects: GitlabProjectDTO[]): ProjectDTO[] {
    const projects = giltabProjects.map(it =>
        Object.assign(it,
            {
                yamlMetadata: {
                    hasMetadata: false,
                    content: {},
                    text: ""
                }
            }
        ) as ProjectDTO)

    for (const project of projects) {
        if(!project.description)
            continue
        
        project.yamlMetadata.text = project.description
        
        const descriptionData = project.description.split('---')
        project.yamlMetadata.hasMetadata = descriptionData.length > 1
        if (project.yamlMetadata.hasMetadata) {
            project.yamlMetadata.text = descriptionData[0]
            project.yamlMetadata.content = YAML.parse(`---${descriptionData[1]}`)
        }
    }

    return projects
}