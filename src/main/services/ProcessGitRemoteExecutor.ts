import { exec } from 'node:child_process'
import { ExecException } from 'child_process'
import {
    GitRemoteAddCliHandler,
    GitRemoteRenameCliHandler,
    GitRemoteRemoveCliHandler,
} from './GitCliHandlers/GitRemoteCliHandler'
import { GitPushAllCliHandler } from './GitCliHandlers/GitPushAllCliHandler'
import { GitRemoteExecutor } from './Publisher'

export class ProcessGitRemoteExecutor implements GitRemoteExecutor {
    async remoteExists(localPath: string, name: string): Promise<boolean> {
        const url = await this.getRemoteUrl(localPath, name)
        return url !== null
    }

    async getRemoteUrl(localPath: string, name: string): Promise<string | null> {
        try {
            return await new Promise<string>((resolve, reject) => {
                exec(
                    `git remote get-url ${name}`,
                    { cwd: localPath },
                    (error: ExecException | null, stdout: string) => {
                        if (error)
                            return reject(error)
                        resolve(stdout.trim())
                    }
                )
            })
        } catch {
            return null
        }
    }

    async renameRemote(localPath: string, from: string, to: string): Promise<void> {
        await new GitRemoteRenameCliHandler(localPath, from, to).execute()
    }

    async removeRemote(localPath: string, name: string): Promise<void> {
        await new GitRemoteRemoveCliHandler(localPath, name).execute()
    }

    async addRemote(localPath: string, name: string, url: string): Promise<void> {
        await new GitRemoteAddCliHandler(localPath, name, url).execute()
    }

    async pushAll(localPath: string, remoteName: string): Promise<boolean> {
        return new GitPushAllCliHandler(localPath, remoteName).execute()
    }
}
