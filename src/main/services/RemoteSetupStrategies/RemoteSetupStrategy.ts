import type { ExistingRemoteBehaviour, GitRemoteExecutor } from '../Publisher'
import { remoteHostMatchesConfig } from '../Publisher'

export type RemoteSetupContext = {
    localPath: string
    remoteName: string
    remoteUrl: string
    replaceSuffix: string
}

export abstract class RemoteSetupStrategy {
    abstract apply(git: GitRemoteExecutor, ctx: RemoteSetupContext): Promise<void>

    static resolve(
        remoteExists: boolean,
        remoteUrl: string | null,
        configHost: string,
        existing: ExistingRemoteBehaviour
    ): RemoteSetupStrategy {
        if (!remoteExists || !remoteUrl) {
            const { AddRemoteStrategy } = require('./AddRemoteStrategy')
            return new AddRemoteStrategy()
        }

        if (remoteHostMatchesConfig(remoteUrl, configHost)) {
            const { PushOnlyStrategy } = require('./PushOnlyStrategy')
            return new PushOnlyStrategy()
        }

        if (existing === 'rename') {
            const { RenameExistingRemoteStrategy } = require('./RenameExistingRemoteStrategy')
            return new RenameExistingRemoteStrategy()
        }

        const { ReplaceExistingRemoteStrategy } = require('./ReplaceExistingRemoteStrategy')
        return new ReplaceExistingRemoteStrategy()
    }
}
