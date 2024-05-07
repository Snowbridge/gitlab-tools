

import * as fs from 'fs'
import { exec } from 'node:child_process'
import { ExecException } from "child_process"
import { ProjectDTO } from '../common/DTO/Project'
import * as Path from 'node:path'

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
        this.directory = trimSlashes(directory)
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

                const cloneHandlerMethod = this.getHandlerMethod(workingCopyAlreadyExists)

                if(!cloneHandlerMethod){
                    console.log('Склонирован ранее и пропущен ' + project.path_with_namespace)
                    continue
                }

                await cloneHandlerMethod(gitPath, absoluteLocalPath)

            } catch (error) {
                switch (this.onFailNetwork) {
                    case 'retry':
                        if(this.onFailNetworkRetiesCount>queueElement.attempt){
                            queueElement.attempt += 1
                            projectsQueue.push(queueElement)
    
                        }                        
                        break;
                    case 'abort':
                        return
                }                
            }
        }
    }

    private getHandlerMethod(workingCopyAlreadyExists: boolean) {
        if (workingCopyAlreadyExists) {
            switch (this.existingBehaviour) {
                case 'skip':
                    return undefined
                case 'fetch':
                    return this.gitFetch
                case 'pull':
                    return this.gitPull
            }
        }
        return this.gitClone
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

    private async executeConsoleCommand(command: string, workDir: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject): void => {
            try {
                exec(command,
                    {
                        cwd: workDir
                    },
                    (error: ExecException | null, stdout: string, stderr: string) => {
                        if (error)
                            throw { error: error, stdout: stdout, stderr: stderr }

                        resolve(true)
                    }
                )
            } catch (error) {
                reject(false)
            }
        })
    }

    private async gitClone(gitPath: string, localPath: string) {
        if (await this.executeConsoleCommand(
            `git clone ${this.gitCloneFlags} ${gitPath} ${localPath}`,
            '.'
        )) {
            console.log('Успешно склонирован ' + gitPath)
        } else {
            console.error('Не удалось склонировать ' + gitPath)
        }
    }

    private async gitFetch(_gitPath: string, localPath: string) {
        if (await this.executeConsoleCommand(
            `git fetch ${this.gitFetchFlags}`,
            localPath
        )) {
            console.log("Успешно получены изменения в " + localPath)
        } else {
            console.error('Не удалось получить изменения для ' + localPath)
        }
    }

    private async gitPull(_gitPath: string, localPath: string) {
        if (await this.executeConsoleCommand(
            `git pull ${this.gitPullFlags}`,
            localPath
        )) {
            console.log("Успешно смержены изменения в " + localPath)
        } else {
            console.error('Не удалось смержить изменения для ' + localPath)
        }
    }

}

// strips off leadng and trailing path delimeter `/qwe/asd/zc/` >> `qwe/asd/zxc`
function trimSlashes(directory: string): string {
    return directory.replace(/(^(\/|\\)*)|((\/|\\)*$)/g, '')
}
