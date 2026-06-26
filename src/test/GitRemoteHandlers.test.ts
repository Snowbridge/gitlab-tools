import { exec } from 'node:child_process'
import {
    GitRemoteAddCliHandler,
    GitRemoteGetUrlCliHandler,
    GitRemoteRemoveCliHandler,
    GitRemoteRenameCliHandler,
} from '../main/services/GitCliHandlers/GitRemoteCliHandler'
import { GitPushAllCliHandler } from '../main/services/GitCliHandlers/GitPushAllCliHandler'
import { ProcessGitRemoteExecutor } from '../main/services/ProcessGitRemoteExecutor'

jest.mock('node:child_process', () => ({
    exec: jest.fn(),
}))

const execMock = exec as unknown as jest.Mock

describe('GitRemoteCliHandler', () => {
    it('builds get-url command', () => {
        expect(new GitRemoteGetUrlCliHandler('/repo', 'origin').getCommand()).toBe(
            'git remote get-url origin'
        )
    })

    it('builds add command', () => {
        expect(
            new GitRemoteAddCliHandler('/repo', 'origin', 'ssh://git@host/repo.git').getCommand()
        ).toBe('git remote add origin ssh://git@host/repo.git')
    })

    it('builds remove command', () => {
        expect(new GitRemoteRemoveCliHandler('/repo', 'origin').getCommand()).toBe(
            'git remote remove origin'
        )
    })

    it('builds rename command', () => {
        expect(new GitRemoteRenameCliHandler('/repo', 'origin', 'origin_old').getCommand()).toBe(
            'git remote rename origin origin_old'
        )
    })

    it('executes with cwd', async () => {
        execMock.mockImplementation((_cmd, opts, callback) => {
            expect(opts.cwd).toBe('/repo')
            callback(null, 'ssh://git@host/repo.git', '')
        })

        await new GitRemoteGetUrlCliHandler('/repo', 'origin').execute()
    })
})

describe('GitPushAllCliHandler', () => {
    it('builds push all and tags command', () => {
        expect(new GitPushAllCliHandler('/repo', 'origin').getCommand()).toBe(
            'git push --all origin && git push --tags origin'
        )
    })

    it('returns false when git push output is up to date', async () => {
        execMock.mockImplementation((_cmd, _opts, callback) => {
            callback(null, '', 'To ssh://git@host/repo.git\nEverything up-to-date\n')
        })

        await expect(new GitPushAllCliHandler('/repo', 'origin').execute()).resolves.toBe(false)
    })

    it('returns true when git push output indicates transfer', async () => {
        execMock.mockImplementation((_cmd, _opts, callback) => {
            callback(null, '', 'To ssh://git@host/repo.git\n   abc..def  main -> main\n')
        })

        await expect(new GitPushAllCliHandler('/repo', 'origin').execute()).resolves.toBe(true)
    })
})

describe('ProcessGitRemoteExecutor', () => {
    beforeEach(() => {
        execMock.mockReset()
    })

    it('returns remote url when git succeeds', async () => {
        execMock.mockImplementation((_cmd, _opts, callback) => {
            callback(null, 'git@gitlab.com:org/repo.git\n', '')
        })

        const executor = new ProcessGitRemoteExecutor()
        await expect(executor.getRemoteUrl('/repo', 'origin')).resolves.toBe(
            'git@gitlab.com:org/repo.git'
        )
    })

    it('returns null when remote is missing', async () => {
        execMock.mockImplementation((_cmd, _opts, callback) => {
            callback(new Error('missing'), '', '')
        })

        const executor = new ProcessGitRemoteExecutor()
        await expect(executor.getRemoteUrl('/repo', 'origin')).resolves.toBeNull()
        await expect(executor.remoteExists('/repo', 'origin')).resolves.toBe(false)
    })

    it('delegates addRemote to handler', async () => {
        execMock.mockImplementation((_cmd, _opts, callback) => {
            callback(null, '', '')
        })

        const executor = new ProcessGitRemoteExecutor()
        await executor.addRemote('/repo', 'origin', 'ssh://git@host/repo.git')
        expect(execMock).toHaveBeenCalledWith(
            'git remote add origin ssh://git@host/repo.git',
            expect.objectContaining({ cwd: '/repo' }),
            expect.any(Function)
        )
    })
})
