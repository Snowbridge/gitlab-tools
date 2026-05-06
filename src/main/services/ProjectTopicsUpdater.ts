import { ProcessableElementsQueue } from '../common/ProcessableElementsQueue'
import { ProjectDTO } from '../common/DTO/Project'

export type TopicsCommand = 'add' | 'remove' | 'clear'

export type GitlabProjectTopicsClient = {
    updateProjectData(projectId: number, data: { topics: string[] }): Promise<void>
}

function topicsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

export function planProjectTopicUpdates(
    projects: ProjectDTO[],
    command: TopicsCommand,
    topics: string[] | undefined
): ProjectDTO[] {
    const out: ProjectDTO[] = []
    for (const project of projects) {
        let nextTopics: string[] | null = null
        switch (command) {
            case 'add': {
                if (!topics?.length) break
                const toAdd = topics.filter((t) => !project.topics.includes(t))
                if (toAdd.length) {
                    nextTopics = [...project.topics, ...toAdd]
                }
                break
            }
            case 'remove': {
                if (!project.topics.length || !topics?.length) break
                nextTopics = project.topics.filter((t) => !topics.includes(t))
                if (nextTopics.length === project.topics.length) {
                    nextTopics = null
                }
                break
            }
            case 'clear': {
                if (project.topics.length) {
                    nextTopics = []
                }
                break
            }
        }
        if (nextTopics !== null && !topicsEqual(project.topics, nextTopics)) {
            out.push({ ...project, topics: nextTopics })
        }
    }
    return out
}

export class ProjectTopicsUpdater {
    private gitlab: GitlabProjectTopicsClient
    private onError: 'abort' | 'retry' | 'skip'
    private retries: number

    constructor(gitlab: GitlabProjectTopicsClient, onError: 'abort' | 'retry' | 'skip', retries: number) {
        this.gitlab = gitlab
        this.onError = onError
        this.retries = retries
    }

    async execute(projects: ProjectDTO[], command: TopicsCommand, topics: string[] | undefined): Promise<void> {
        const toUpdate = planProjectTopicUpdates(projects, command, topics)
        const queue = new ProcessableElementsQueue<ProjectDTO>(
            toUpdate,
            this.onError,
            this.retries,
            (p) => p.path_with_namespace
        )
        await queue.executeProcessing(async (project) => {
            await this.gitlab.updateProjectData(project.id, { topics: project.topics })
        })
    }
}
