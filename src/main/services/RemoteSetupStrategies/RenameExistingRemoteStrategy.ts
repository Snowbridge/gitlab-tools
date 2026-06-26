import type { GitRemoteExecutor } from '../Publisher'
import { RemoteSetupContext, RemoteSetupStrategy } from './RemoteSetupStrategy'

export class RenameExistingRemoteStrategy extends RemoteSetupStrategy {
    async apply(git: GitRemoteExecutor, ctx: RemoteSetupContext): Promise<void> {
        await git.renameRemote(
            ctx.localPath,
            ctx.remoteName,
            `${ctx.remoteName}${ctx.replaceSuffix}`
        )
        await git.addRemote(ctx.localPath, ctx.remoteName, ctx.remoteUrl)
    }
}
