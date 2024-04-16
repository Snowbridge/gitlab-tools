

import * as fs from 'fs'
import { exec } from 'node:child_process'
import { ExecException } from "child_process"
import { ProjectDTO } from '../common/DTO/Project'



export type ExistingRepoBehaviour = 'skip' | 'drop' | 'fetch' | 'pull'
export class GitCloner {

    private sanitizePaths: boolean
    private existingBehaviour: ExistingRepoBehaviour
    private directory: string
    private projects: ProjectDTO[]
    private gitSshUrl: string
    private gitCloneFlags?: string
    private gitFetchFlags?: string
    private gitPullFlags?: string
    private ltrimPath: number
    private pinchOffPath: string
    private onFail: 'skip' | 'abort'

    constructor(
        baseSshUrl: string,
        projects: ProjectDTO[],
        directory: string,
        ltrimPath: number,
        sanitizePaths = false,
        existingBehaviour: ExistingRepoBehaviour = 'skip',
        onFail: 'skip' | 'abort',
        gitCloneFlags?: string,
        gitFetchFlags?: string,
        gitPullFlags?: string,
        pinchOffPath?: string
    ) {
        this.gitSshUrl = `ssh://git@${baseSshUrl}`
        this.projects = projects
        this.directory = trimSlashes(directory)
        this.ltrimPath = ltrimPath
        this.existingBehaviour = existingBehaviour
        this.sanitizePaths = sanitizePaths
        this.gitCloneFlags = gitCloneFlags || ''
        this.gitFetchFlags = gitFetchFlags || '--all --prune --force'
        this.gitPullFlags = gitPullFlags || '--progress -v --no-rebase "origin"'
        this.pinchOffPath = `${pinchOffPath}`
        this.onFail = onFail
    }

    async execute() {

        if (!fs.existsSync(this.directory))
            fs.mkdirSync(this.directory, {
                recursive: true
            })

        for (const project of this.projects) {
            try {
                const relativePath = this.getLocalPath(trimSlashes(project.path_with_namespace))
                const localPath = `${this.directory}/${relativePath}`
                const gitPath = `${this.gitSshUrl}/${project.path_with_namespace}.git`

                if (fs.existsSync(localPath)) {
                    switch (this.existingBehaviour) {
                        case "skip":
                            console.log('Склонирован ранее и пропущен ' + localPath)
                            continue
                        case "fetch":
                            await this.gitFetch(localPath)
                            continue
                        case "pull":
                            await this.gitPull(localPath)
                            continue
                    }
                    fs.rmSync(localPath, {
                        force: true,
                        recursive: true
                    } as fs.RmOptions)
                } else {
                    fs.mkdirSync(localPath, {
                        recursive: true
                    })
                }

                await this.gitClone(gitPath, localPath)
            } catch (error) {
                if (this.onFail == 'abort')
                    throw error
            }
        }


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

    private async gitFetch(localPath: string) {
        if (await this.executeConsoleCommand(
            `git fetch ${this.gitFetchFlags}`,
            localPath
        )) {
            console.log("Успешно получены изменения в " + localPath)
        } else {
            console.error('Не получить изменения для ' + localPath)
        }
    }

    private async gitPull(localPath: string) {
        if (await this.executeConsoleCommand(
            `git pull ${this.gitPullFlags}`,
            localPath
        )) {
            console.log("Успешно смержены изменения в " + localPath)
        } else {
            console.error('Не смержить изменения для ' + localPath)
        }
    }

    private getLocalPath(path: string): string {

        return path
            .replace(this.pinchOffPath, '')
            .split('/')
            .map(it => this.sanitizePaths ? encodeURIComponent(it) : it)
            .slice(this.ltrimPath)
            .join('/')
    }

}

// strips off leadng and trailing path delimeter `/qwe/asd/zc/` >> `qwe/asd/zxc`
function trimSlashes(directory: string): string {
    return directory.replace(/(^(\/|\\)*)|((\/|\\)*$)/g, '')
}