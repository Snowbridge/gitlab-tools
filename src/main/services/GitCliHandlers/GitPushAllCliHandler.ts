import { exec } from 'node:child_process'
import { ExecException } from 'child_process'
import { gitPushOutputIndicatesTransfer } from './gitPushOutputIndicatesTransfer'
import { AbstractGitCliHandlerWithCwd } from './GitRemoteCliHandler'

export class GitPushAllCliHandler extends AbstractGitCliHandlerWithCwd {
    private remoteName: string

    constructor(localPath: string, remoteName: string) {
        super(localPath)
        this.remoteName = remoteName
    }

    getCommand(): string {
        return `git push --all ${this.remoteName} && git push --tags ${this.remoteName}`
    }

    async execute(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject): void => {
            exec(
                this.getCommand(),
                { cwd: this.localPath },
                (error: ExecException | null, stdout: string, stderr: string) => {
                    if (error)
                        return reject({ error: error, stdout: stdout, stderr: stderr })

                    resolve(gitPushOutputIndicatesTransfer(`${stdout}${stderr}`))
                }
            )
        })
    }
}
