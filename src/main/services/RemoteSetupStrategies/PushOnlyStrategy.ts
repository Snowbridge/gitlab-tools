import type { GitRemoteExecutor } from '../Publisher'
import { RemoteSetupContext, RemoteSetupStrategy } from './RemoteSetupStrategy'

export class PushOnlyStrategy extends RemoteSetupStrategy {
    async apply(_git: GitRemoteExecutor, _ctx: RemoteSetupContext): Promise<void> {
    }
}
