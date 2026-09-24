import { exec } from 'node:child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
    GitMergeCliHandler,
    getGlobalDefaultBranch,
    hasBranch,
} from '../main/services/GitCliHandlers/GitMergeCliHandler'
import { GitBranchDeleteCliHandler } from '../main/services/GitCliHandlers/GitBranchDeleteCliHandler'
import {
    argvToMergeOptions,
    argvToMergePostBranchOptions,
    builder,
    checkMergeArgs,
    handler,
} from '../main/infrastructure/cli/workspace/merge'

jest.mock('node:child_process', () => ({
    exec: jest.fn(),
}))

const execMock = exec as unknown as jest.Mock

function mockExecImpl(
    impl: (cmd: string, opts: any, callback: (e: any, stdout: string, stderr: string) => void) => void
): void {
    execMock.mockImplementation((cmd: string, optsOrCb: any, maybeCb?: any) => {
        const callback = typeof optsOrCb === 'function' ? optsOrCb : maybeCb
        const opts = typeof optsOrCb === 'object' ? optsOrCb : {}
        impl(cmd, opts, callback)
    })
}

describe('GitMergeCliHandler.getCommand', () => {
    beforeEach(() => {
        execMock.mockReset()
    })

    it('builds basic merge command', () => {
        expect(new GitMergeCliHandler('/repo', { from: 'dev' }).getCommand()).toBe('git merge dev')
    })

    it('builds --no-ff with -m message', () => {
        expect(
            new GitMergeCliHandler('/repo', { from: 'dev', noFf: true, message: 'msg' }).getCommand()
        ).toBe('git merge --no-ff -m msg dev')
    })

    it('repeats -X for each strategy option', () => {
        expect(
            new GitMergeCliHandler('/repo', {
                from: 'dev',
                strategyOption: ['ours', 'theirs'],
            }).getCommand()
        ).toBe('git merge -X ours -X theirs dev')
    })

    it('quotes branches with spaces', () => {
        expect(
            new GitMergeCliHandler('/repo', { from: 'my branch' }).getCommand()
        ).toBe('git merge "my branch"')
        expect(
            new GitMergeCliHandler('/repo', { from: 'dev', message: 'my msg' }).getCommand()
        ).toBe('git merge -m "my msg" dev')
    })

    it('executes with cwd', async () => {
        mockExecImpl((cmd, opts, callback) => {
            expect(opts.cwd).toBe('/repo')
            expect(cmd).toBe('git merge dev')
            callback(null, '', '')
        })
        await new GitMergeCliHandler('/repo', { from: 'dev' }).execute()
        expect(execMock).toHaveBeenCalledWith(
            'git merge dev',
            expect.objectContaining({ cwd: '/repo' }),
            expect.any(Function)
        )
    })
})

describe('GitBranchDeleteCliHandler.getCommand', () => {
    it('builds -d delete command', () => {
        expect(new GitBranchDeleteCliHandler('/repo', { branch: 'dev' }).getCommand()).toBe(
            'git branch -d dev'
        )
    })

    it('quotes branch names with spaces', () => {
        expect(new GitBranchDeleteCliHandler('/repo', { branch: 'my branch' }).getCommand()).toBe(
            'git branch -d "my branch"'
        )
    })

    it('uses -D when force is set', () => {
        expect(
            new GitBranchDeleteCliHandler('/repo', { branch: 'dev', force: true }).getCommand()
        ).toBe('git branch -D dev')
    })
})

describe('argvToMergePostBranchOptions', () => {
    it('maps stay and keep-source-branch aliases', () => {
        expect(argvToMergePostBranchOptions({ stay: true })).toEqual({
            stay: true,
            keepSourceBranch: false,
        })
        expect(argvToMergePostBranchOptions({ s: true })).toEqual({
            stay: true,
            keepSourceBranch: false,
        })
        expect(argvToMergePostBranchOptions({ keep: true })).toEqual({
            stay: false,
            keepSourceBranch: true,
        })
        expect(argvToMergePostBranchOptions({ k: true })).toEqual({
            stay: false,
            keepSourceBranch: true,
        })
        expect(argvToMergePostBranchOptions({ 'keep-source-branch': true })).toEqual({
            stay: false,
            keepSourceBranch: true,
        })
    })
})

describe('argvToMergeOptions', () => {
    it('maps kebab-case flags and aliases', () => {
        const opts = argvToMergeOptions({
            from: 'dev',
            'no-ff': true,
            'ff-only': false,
            squash: true,
            m: 'msg',
            X: ['ours', 'theirs'],
        })
        expect(opts).toMatchObject({
            from: 'dev',
            noFf: true,
            ffOnly: false,
            squash: true,
            message: 'msg',
            strategyOption: ['ours', 'theirs'],
        })
    })

    it('wraps single strategy option into array', () => {
        const opts = argvToMergeOptions({ from: 'dev', 'strategy-option': 'ours' })
        expect(opts.strategyOption).toEqual(['ours'])
    })

    it('leaves strategyOption undefined when absent', () => {
        const opts = argvToMergeOptions({ from: 'dev' })
        expect(opts.strategyOption).toBeUndefined()
    })
})

describe('checkMergeArgs', () => {
    it('rejects repos together with --all', () => {
        expect(() =>
            checkMergeArgs({ from: 'dev', repos: ['./a'], all: true, interactive: false })
        ).toThrow('Нельзя указывать рабочие копии вместе с --all или --interactive')
    })

    it('requires repos, --all or --interactive', () => {
        expect(() =>
            checkMergeArgs({ from: 'dev', repos: [], all: false, interactive: false })
        ).toThrow('Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive')
    })

    it('rejects --all with --interactive', () => {
        expect(() =>
            checkMergeArgs({ from: 'dev', repos: [], all: true, interactive: true })
        ).toThrow('Опции --interactive и --all не могут использоваться вместе')
    })

    it('rejects --stay with --keep-source-branch', () => {
        expect(() =>
            checkMergeArgs({
                from: 'dev',
                repos: ['./a'],
                all: false,
                interactive: false,
                stay: true,
                keep: true,
            })
        ).toThrow('Опции --stay и --keep-source-branch не могут использоваться вместе')
    })

    it('requires <from>', () => {
        expect(() =>
            checkMergeArgs({ repos: ['./a'], all: false, interactive: false })
        ).toThrow('Не указана ветка для слияния. Укажите <from>')
    })

    it('accepts valid args with optional [to]', () => {
        expect(
            checkMergeArgs({ from: 'dev', to: 'main', repos: ['./a'], all: false, interactive: false })
        ).toBe(true)
        expect(checkMergeArgs({ from: 'dev', repos: [], all: true, interactive: false })).toBe(true)
    })

    it('builder registers check with identical messages', () => {
        const checks: Array<(argv: any) => boolean> = []
        const fakeY: any = {
            usage() {
                return this
            },
            positional() {
                return this
            },
            options() {
                return this
            },
            epilog() {
                return this
            },
            check(fn: (argv: any) => boolean) {
                checks.push(fn)
                return this
            },
        }
        builder(fakeY)
        expect(checks).toHaveLength(1)
        expect(() => checks[0]({ repos: [], all: false, interactive: false })).toThrow(
            'Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive'
        )
    })
})

describe('getGlobalDefaultBranch', () => {
    beforeEach(() => {
        execMock.mockReset()
    })

    it('returns configured value', async () => {
        mockExecImpl((cmd, _opts, callback) => {
            expect(cmd).toContain('init.defaultBranch')
            callback(null, '  main\n', '')
        })
        await expect(getGlobalDefaultBranch()).resolves.toBe('main')
    })

    it('falls back to master on empty output', async () => {
        mockExecImpl((_cmd, _opts, callback) => {
            callback(null, '   \n', '')
        })
        await expect(getGlobalDefaultBranch()).resolves.toBe('master')
    })

    it('falls back to master on exec error', async () => {
        mockExecImpl((_cmd, _opts, callback) => {
            callback(new Error('no config'), '', '')
        })
        await expect(getGlobalDefaultBranch()).resolves.toBe('master')
    })
})

describe('hasBranch', () => {
    beforeEach(() => {
        execMock.mockReset()
    })

    it('finds local branch', async () => {
        mockExecImpl((cmd, opts, callback) => {
            expect(cmd).toBe('git show-ref')
            expect(opts.cwd).toBe('/repo')
            callback(null, 'abc123 refs/heads/dev\ndef456 refs/heads/main\n', '')
        })
        await expect(hasBranch('/repo', 'dev')).resolves.toBe(true)
    })

    it('finds only remote branch', async () => {
        mockExecImpl((_cmd, _opts, callback) => {
            callback(null, 'abc123 refs/remotes/origin/dev\n', '')
        })
        await expect(hasBranch('/repo', 'dev')).resolves.toBe(true)
    })

    it('returns false when branch is nowhere', async () => {
        mockExecImpl((_cmd, _opts, callback) => {
            callback(null, 'abc123 refs/heads/main\ndef456 refs/remotes/origin/main\n', '')
        })
        await expect(hasBranch('/repo', 'dev')).resolves.toBe(false)
    })

    it('returns false on exec error', async () => {
        mockExecImpl((_cmd, _opts, callback) => {
            callback(new Error('no refs'), '', 'fatal: not a git repository')
        })
        await expect(hasBranch('/repo', 'dev')).resolves.toBe(false)
    })

    it('does not confuse prefixed branch names', async () => {
        mockExecImpl((_cmd, _opts, callback) => {
            callback(null, 'abc123 refs/heads/develop\n', '')
        })
        await expect(hasBranch('/repo', 'dev')).resolves.toBe(false)
    })
})

describe('merge handler loop', () => {
    let tmpRoot: string
    let logSpy: jest.SpyInstance
    let errorSpy: jest.SpyInstance

    beforeEach(() => {
        execMock.mockReset()
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-merge-'))
        for (const rel of ['a', 'b']) {
            fs.mkdirSync(path.join(tmpRoot, rel, '.git'), { recursive: true })
        }
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        process.exitCode = 0
    })

    afterEach(() => {
        logSpy.mockRestore()
        errorSpy.mockRestore()
        process.exitCode = 0
        fs.rmSync(tmpRoot, { recursive: true, force: true })
    })

    function baseArgv(overrides: Record<string, any> = {}): any {
        return {
            dir: tmpRoot,
            all: false,
            interactive: false,
            repos: ['a', 'b'],
            from: 'dev',
            to: 'main',
            ...overrides,
        }
    }

    const showRefBothBranches = 'abc refs/heads/dev\ndef refs/heads/main\n'

    function showRefWithDev(): void {
        mockExecImpl((cmd, _opts, callback) => {
            if (cmd === 'git show-ref') {
                callback(null, showRefBothBranches, '')
                return
            }
            if (
                cmd.startsWith('git switch')
                || cmd.startsWith('git merge')
                || cmd.startsWith('git branch -d')
            ) {
                callback(null, '', '')
                return
            }
            callback(null, '', '')
        })
    }

    it('merges successfully: switch to, merge, delete from, stay on to', async () => {
        showRefWithDev()
        await handler(baseArgv())

        const cmds = execMock.mock.calls.map((c) => c[0] as string)
        expect(cmds).toContain('git switch main')
        expect(cmds).toContain('git merge dev')
        expect(cmds).toContain('git branch -d dev')
        expect(cmds).not.toContain('git switch -')
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✔'))
        expect(process.exitCode).toBe(0)
    })

    it('with --stay: switch back and no branch delete', async () => {
        showRefWithDev()
        await handler(baseArgv({ stay: true, repos: ['a'] }))

        const cmds = execMock.mock.calls.map((c) => c[0] as string)
        expect(cmds).toContain('git switch -')
        expect(cmds).not.toContain('git branch -d dev')
    })

    it('with --keep-source-branch: stay on to and no branch delete', async () => {
        showRefWithDev()
        await handler(baseArgv({ keep: true, repos: ['a'] }))

        const cmds = execMock.mock.calls.map((c) => c[0] as string)
        expect(cmds).not.toContain('git switch -')
        expect(cmds).not.toContain('git branch -d dev')
    })

    it('on merge failure still calls switch - and exits 1', async () => {
        mockExecImpl((cmd, _opts, callback) => {
            if (cmd === 'git show-ref') {
                callback(null, showRefBothBranches, '')
                return
            }
            if (cmd === 'git merge dev') {
                callback(new Error('merge failed'), '', 'CONFLICT: ...')
                return
            }
            callback(null, '', '')
        })
        await handler(baseArgv({ repos: ['a'] }))

        const cmds = execMock.mock.calls.map((c) => c[0] as string)
        expect(cmds).toContain('git merge dev')
        expect(cmds).toContain('git switch -')
        expect(cmds).not.toContain('git branch -d dev')
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CONFLICT'))
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Не удалось смержить 1 из 1'))
        expect(process.exitCode).toBe(1)
    })

    it('on switch-to failure merge is not called but switch - is attempted', async () => {
        mockExecImpl((cmd, _opts, callback) => {
            if (cmd === 'git show-ref') {
                callback(null, showRefBothBranches, '')
                return
            }
            if (cmd === 'git switch main') {
                callback(new Error('switch failed'), '', 'error: pathspec ...')
                return
            }
            callback(null, '', '')
        })
        await handler(baseArgv({ repos: ['a'] }))

        const cmds = execMock.mock.calls.map((c) => c[0] as string)
        expect(cmds).toContain('git switch main')
        expect(cmds).toContain('git switch -')
        expect(cmds).not.toContain('git merge dev')
        expect(process.exitCode).toBe(1)
    })

    it('skips copies without both branches and errors when none qualify', async () => {
        mockExecImpl((cmd, _opts, callback) => {
            if (cmd === 'git show-ref') {
                callback(null, 'abc refs/heads/main\n', '')
                return
            }
            callback(null, '', '')
        })
        await handler(baseArgv())

        expect(errorSpy).toHaveBeenCalledWith('Не найдено рабочих копий с ветками dev и main')
        expect(process.exitCode).toBe(1)
        const cmds = execMock.mock.calls.map((c) => c[0] as string)
        expect(cmds).not.toContain('git merge dev')
    })

    it('resolves default [to] once via global config', async () => {
        let configCalls = 0
        mockExecImpl((cmd, _opts, callback) => {
            if (cmd.includes('init.defaultBranch')) {
                configCalls += 1
                callback(null, 'trunk\n', '')
                return
            }
            if (cmd === 'git show-ref') {
                callback(null, 'abc refs/heads/dev\ndef refs/heads/trunk\n', '')
                return
            }
            if (
                cmd.startsWith('git switch')
                || cmd.startsWith('git merge')
                || cmd.startsWith('git branch -d')
            ) {
                callback(null, '', '')
                return
            }
            callback(null, '', '')
        })
        const argv = baseArgv()
        delete argv.to
        await handler(argv)

        expect(configCalls).toBe(1)
        const cmds = execMock.mock.calls.map((c) => c[0] as string)
        expect(cmds).toContain('git switch trunk')
    })
})
