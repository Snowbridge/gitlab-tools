

import * as fs from 'fs'
import { ProjectDTO } from '../common/DTO/Project'
import * as Path from 'node:path'
import { GitFetchCliHandler } from './GitCliHandlers/GitFetchCliHandler'
import { AbstractGitCliHandler } from './GitCliHandlers/AbstractGitCliHandler'
import { GitPullCliHandler } from './GitCliHandlers/GitPullCliHandler'
import { GitCloneCliHandler } from './GitCliHandlers/GitCloneCliHandler'

export type ExistingRepoBehaviour = 'skip' | 'drop' | 'fetch' | 'pull'
export class GitCloner {

    private existingBehaviour: ExistingRepoBehaviour
    private directory: string
    private projects: ProjectDTO[]
    private gitSshUrl: string
    private gitCloneFlags?: string
    private gitFetchFlags?: string
    private gitPullFlags?: string
    private ltrimPath: number
    private onFailFilesystem: 'skip' | 'abort'
    private onFailNetwork: 'abort' | 'skip' | 'retry'
    private onFailNetworkRetiesCount: number

    constructor(
        baseSshUrl: string,
        projects: ProjectDTO[],
        directory: string,
        ltrimPath: number,
        existingBehaviour: ExistingRepoBehaviour = 'skip',
        onFailFilesystem: 'skip' | 'abort',
        onFailNetwork: 'abort' | 'skip' | 'retry',
        onFailNetworkRetiesCount: number,
        gitCloneFlags?: string,
        gitFetchFlags?: string,
        gitPullFlags?: string
    ) {
        this.gitSshUrl = `ssh://git@${baseSshUrl}`
        this.projects = projects
        this.directory = Path.normalize(directory)
        this.ltrimPath = ltrimPath
        this.existingBehaviour = existingBehaviour
        this.gitCloneFlags = gitCloneFlags || ''
        this.gitFetchFlags = gitFetchFlags || '--all --prune --force'
        this.gitPullFlags = gitPullFlags || '--progress -v --no-rebase "origin"'
        this.onFailFilesystem = onFailFilesystem
        this.onFailNetwork = onFailNetwork
        this.onFailNetworkRetiesCount = onFailNetworkRetiesCount
    }

    async execute() {

        if (!fs.existsSync(this.directory))
            fs.mkdirSync(this.directory, {
                recursive: true
            })

        const projectsQueue = this.projects.map(it => {
            return {
                project: it,
                attempt: 0
            }
        })

        while (projectsQueue.length) {
            const queueElement = projectsQueue.shift()
            if (!queueElement)
                throw Error(`Не может такого быть, поскольку цикл крутится только, пока элементы есть`);

            const project = queueElement.project
            const gitPath = `${this.gitSshUrl}/${project.path_with_namespace}.git`
            const absoluteLocalPath = this.getProjectAbsoluteLocalPath(project)
            try {
                fs.mkdirSync(absoluteLocalPath, { recursive: true })

                if (this.existingBehaviour == 'drop') //в случае, если папка пуста, мы ничего не теряем
                    fs.rmSync(
                        Path.join(absoluteLocalPath, "*"),
                        { force: true, recursive: true }
                    )

            } catch (error) {
                if (this.onFailFilesystem == 'abort')
                    throw error

                continue
            }

            try {
                const workingCopyAlreadyExists = fs.existsSync(Path.join(absoluteLocalPath, ".git"))

                const gitCliHandler = this.gitHandlerFactory(workingCopyAlreadyExists, gitPath, absoluteLocalPath)

                if (!gitCliHandler) {
                    console.log('Склонирован ранее и пропущен ' + project.path_with_namespace)
                    continue
                }

                await gitCliHandler.execute()

            } catch (error) {
                switch (this.onFailNetwork) {
                    case 'retry':
                        if (this.onFailNetworkRetiesCount > queueElement.attempt) {
                            queueElement.attempt += 1
                            projectsQueue.push(queueElement)
                            console.log(`Неудачная попытка #${queueElement.attempt} обработки '${queueElement.project.path_with_namespace}', попробуем еще раз позже, осталось попыток ${this.onFailNetworkRetiesCount - queueElement.attempt}`)
                        }
                        break;
                    case 'abort':
                        return
                }
            }
        }
    }

    private getProjectAbsoluteLocalPath(project: ProjectDTO): string {
        return Path.join(
            this.directory,
            project.path_with_namespace
                .split('/')
                .slice(this.ltrimPath)
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