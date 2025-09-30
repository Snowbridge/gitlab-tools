
import ora, { Ora } from 'ora'
import * as fs from 'fs'
import { ProjectDTO } from '../common/DTO/Project'
import * as Path from 'node:path'
import { GitFetchCliHandler } from './GitCliHandlers/GitFetchCliHandler'
import { AbstractGitCliHandler } from './GitCliHandlers/AbstractGitCliHandler'
import { GitPullCliHandler } from './GitCliHandlers/GitPullCliHandler'
import { GitCloneCliHandler } from './GitCliHandlers/GitCloneCliHandler'
import { ProcessableElementsQueue } from '../common/ProcessableElementsQueue'

export type ExistingRepoBehaviour = 'skip' | 'drop' | 'fetch' | 'pull'
export class GitCloner {

    private existingBehaviour: ExistingRepoBehaviour
    private directory: string
    private gitSshUrl: string
    private gitCloneFlags?: string
    private gitFetchFlags?: string
    private gitPullFlags?: string
    private trimPath: number
    private projects: ProcessableElementsQueue<ProjectDTO>
    private onError: 'abort' | 'skip' | 'retry'

    constructor(
        baseSshUrl: string,
        projects: ProjectDTO[],
        directory: string,
        trimPath: number,
        existingBehaviour: ExistingRepoBehaviour = 'skip',
        onError: 'abort' | 'skip' | 'retry',
        retries: number,
        gitCloneFlags?: string,
        gitFetchFlags?: string,
        gitPullFlags?: string
    ) {
        this.gitSshUrl = `ssh://git@${baseSshUrl}`
        this.directory = Path.normalize(directory)
        this.trimPath = trimPath
        this.existingBehaviour = existingBehaviour
        this.gitCloneFlags = gitCloneFlags || ''
        this.gitFetchFlags = gitFetchFlags || '--all --prune --force'
        this.gitPullFlags = gitPullFlags || '--progress -v --no-rebase "origin"'
        this.projects = new ProcessableElementsQueue<ProjectDTO>(projects, onError, retries)
        this.onError = onError
    }

    async execute() {

        if (!fs.existsSync(this.directory))
            fs.mkdirSync(this.directory, {
                recursive: true
            })

        await this.projects.executeProcessing(async (project) => {
            const gitPath = `${this.gitSshUrl}/${project.path_with_namespace}.git`
            const absoluteLocalPath = this.getProjectAbsoluteLocalPath(project)
            const spinner = ora(`${project.name_with_namespace}`).start()

            fs.mkdirSync(absoluteLocalPath, { recursive: true }) // если это свалится, то ретраить ничего не будем

            if (this.existingBehaviour == 'drop') //в случае, если папка пуста, мы ничего не теряем
                fs.rmSync(
                    Path.join(absoluteLocalPath, "*"),
                    { force: true, recursive: true }
                )

            const workingCopyAlreadyExists = fs.existsSync(Path.join(absoluteLocalPath, ".git"))
            const handler = this.gitHandlerFactory(workingCopyAlreadyExists, gitPath, absoluteLocalPath)
            if (!!handler) {
                await handler.execute()
                spinner.succeed()    
            } else{
                spinner.suffixText = '(был склонирован ранее и пропущен)'
                spinner.succeed()
            }
        })
    }

    private getProjectAbsoluteLocalPath(project: ProjectDTO): string {
        return Path.join(
            Path.resolve(
                this.directory
            ),
            project.path_with_namespace
                .split('/')
                .slice(this.trimPath)
                .join('/')
        )
    }

    private gitHandlerFactory(workingCopyAlreadyExists: boolean, remotePath: string, localPath: string): AbstractGitCliHandler | undefined {
        if (workingCopyAlreadyExists) {
            switch (this.existingBehaviour) {
                case 'skip':
                    return undefined
                case 'fetch':
                    return new GitFetchCliHandler(localPath, this.gitFetchFlags || '')
                case 'pull':
                    return new GitPullCliHandler(localPath, this.gitPullFlags || '')
            }
        }
        return new GitCloneCliHandler(remotePath, localPath, this.gitCloneFlags || '') // ну, да, не очень круто, что зависимость от реализаций сохраняется, но думать дальше лень
    }
}