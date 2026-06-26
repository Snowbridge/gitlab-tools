import type { GitRemoteExecutor } from '../Publisher'
import { RemoteSetupContext, RemoteSetupStrategy } from './RemoteSetupStrategy'

export class AddRemoteStrategy extends RemoteSetupStrategy {
    async apply(git: GitRemoteExecutor, ctx: RemoteSetupContext): Promise<void> {
        await git.addRemote(ctx.localPath, ctx.remoteName, ctx.remoteUrl)
    }
}
