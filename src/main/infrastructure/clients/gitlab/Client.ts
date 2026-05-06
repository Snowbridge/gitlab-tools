import { AxiosRequestConfig } from "axios";
import { GitlabProjectDTO } from "../../../common/DTO/Gitlab/ProjectDTO";
import { BaseAxiosClient } from "../BaseClient";
import { ParameterExpression } from "../../../common/ParameterExpression";

export class GitlabApi extends BaseAxiosClient {

    constructor(url: string, token: string) {
        super(`https://${url}/api/v4`, token)
    }

    async getProjects(queryExpressions: ParameterExpression[]): Promise<GitlabProjectDTO[]> {
        let queryString = buildQueryString(queryExpressions)

        let namesArray = queryExpressions
            .filter(it => it.getType() == 'QueryNameExpression')
            .map(it => it.getRightValue())

        if (namesArray.length == 0)
            namesArray = [''] // если отборов по именам не задано, то будет одна итерация по пустому имени

        const projects: GitlabProjectDTO[] = []
        const params = {
            page: 1
        }

        for (let projectNameOrNumber of namesArray) {
            const projectId = encodeURIComponent(`${projectNameOrNumber}`)
            const url = `/projects/${projectId}?${queryString}`

            const total = await this.getTotalPages(url)
            for (let index = 0; index < total; index++) {
                const { data } = await this.get<GitlabProjectDTO[] | GitlabProjectDTO>(url, { params: params })
                projects.push(...Array.isArray(data) ? data : [data])
                params.page++
            }
        }

        return projects
    }

    async updateProjectData(projectId: number, data: Partial<GitlabProjectDTO>): Promise<void> {
        await this.put<void>(`/projects/${projectId}`, data)
    }

    private async getTotalPages(url: string, config?: AxiosRequestConfig): Promise<number> {
        let { headers } = await this.head(url, config)
        return headers['x-total-pages'] || 1
    }
}

function buildQueryString(expressions: ParameterExpression[]): string {
    return expressions
        .filter(it => it.getType() == 'QueryAttributeExpression')
        .map(it => `${it.getLeftValue()}=${it.getRightValue()}`)
        .join('&')
}