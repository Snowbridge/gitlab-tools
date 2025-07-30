import YAML from 'yaml'
import { ProjectDTO } from "../common/DTO/Project";
import { ParameterExpression } from "../common/ParameterExpression";
import { GitlabApi } from "../infrastructure/clients/gitlab/Client";
import { ProcessableElementsQueue } from '../common/ProcessableElementsQueue';
import ora from 'ora'

export class Updater {
    private projects: ProjectDTO[]
    private expressions: ParameterExpression[]
    private gitlab: GitlabApi
    private onError: 'skip' | 'retry' | 'abort'
    private retriesCount: number

    constructor(projects: ProjectDTO[], updateExpressions: ParameterExpression[], gitlab: GitlabApi, onError: 'skip' | 'retry' | 'abort', retriesCount: number) {
        this.projects = projects
        this.expressions = updateExpressions
        this.gitlab = gitlab
        this.expressions.sort((a: ParameterExpression, b: ParameterExpression) => a.getIndex() - b.getIndex())
        this.onError = onError
        this.retriesCount = retriesCount
    }

    async execute() {
        for (const project of this.projects) {
            // сначала выполнить все обработки в оперативе над копиями репозиториев
            for (const expression of this.expressions) {
                process(project, expression)
            }            
        }

        // а потом отправить на сервер данные репозитория в рамках обработки retriable queue
        const queue = new ProcessableElementsQueue<ProjectDTO>(this.projects, this.onError, this.retriesCount)
        queue.executeProcessing(async (project:ProjectDTO)=>{
            const spinner = ora(`${project.name_with_namespace}`).start()
            const metadata = project.yamlMetadata
            let description = [metadata.text.trim()]
            if (metadata.hasMetadata)
                description.push(...['---', YAML.stringify(metadata.content)])

            let payload: Record<string, any> = {}
            payload.description = description.join('\n').trim()
            await this.gitlab.put(`/projects/${project.id}`, payload)
            spinner.succeed()
        })
    }
}

function process(project: ProjectDTO, expression: ParameterExpression) {
    const processor = (expression.getType() == 'UpdateMetadataModelExpression') ? replaceMetadata : modifyMetadataContent
    processor(project, expression)
}

function replaceMetadata(project: ProjectDTO, expression: ParameterExpression) {
    project.yamlMetadata.hasMetadata = expression.getRightValue() != ""
    project.yamlMetadata.content = {}

    if (project.yamlMetadata.hasMetadata)
        project.yamlMetadata.content = expression.getValue()
}

function modifyMetadataContent(project: ProjectDTO, expression: ParameterExpression) {
    let schema = project.yamlMetadata.content

    const keyPathTokens = expression.getLeftValue().split('.')
    const length = keyPathTokens.length

    for (let i = 0; i < length - 1; i++) {
        let token = keyPathTokens[i]
        if (!schema[token])
            schema[token] = {}
        schema = schema[token]
    }

    switch (expression.getType()) {
        case 'UpdateMetadataKeyExpression':
            schema[keyPathTokens[length - 1]] = expression.getRightValue()
            break
        case 'UpdateMetadataArrayPushExpression':
            if (!Array.isArray(schema[keyPathTokens[length - 1]]))
                schema[keyPathTokens[length - 1]] = []

            if (!schema[keyPathTokens[length - 1]].includes(expression.getRightValue()))
                schema[keyPathTokens[length - 1]].push(expression.getRightValue())
            break
        case 'UpdateMetadataArrayRemoveExpression':
            if (!Array.isArray(schema[keyPathTokens[length - 1]]))
                schema[keyPathTokens[length - 1]] = []

            schema[keyPathTokens[length - 1]] = schema[keyPathTokens[length - 1]].filter((it: string) => it != expression.getRightValue())
            break
        case 'UpdateMetadataArrayClearExpression':
            schema[keyPathTokens[length - 1]] = []
            break
        case 'UpdateMetadataDropKeyExpression':
            delete schema[keyPathTokens[length - 1]]
            break
        default:
            throw Error(`Операция ${expression.getType()} не имплементирована в клакссе Updater.ts`)
    }
}
