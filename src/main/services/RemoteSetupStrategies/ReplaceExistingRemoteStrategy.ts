import type { GitRemoteExecutor } from '../Publisher'
import { RemoteSetupContext, RemoteSetupStrategy } from './RemoteSetupStrategy'

export class ReplaceExistingRemoteStrategy extends RemoteSetupStrategy {
    async apply(git: GitRemoteExecutor, ctx: RemoteSetupContext): Promise<void> {
        await git.removeRemote(ctx.localPath, ctx.remoteName)
        await git.addRemote(ctx.localPath, ctx.remoteName, ctx.remoteUrl)
    }
}
