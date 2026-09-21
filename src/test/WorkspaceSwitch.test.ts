import { exec } from 'node:child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
    GitSwitchCliHandler,
    quoteArg,
} from '../main/services/GitCliHandlers/GitSwitchCliHandler'
import { resolveWorkspaceCopies } from '../main/services/Workspace'
import { argvToSwitchOptions, builder, checkSwitchArgs } from '../main/infrastructure/cli/workspace/switch'
import { builder as workspaceBuilder } from '../main/infrastructure/cli/workspace'

jest.mock('node:child_process', () => ({
    exec: jest.fn(),
}))

const execMock = exec as unknown as jest.Mock

describe('GitSwitchCliHandler', () => {
    beforeEach(() => {
        execMock.mockReset()
    })

    it('builds plain switch command', () => {
        expect(new GitSwitchCliHandler('/repo', { branch: 'main' }).getCommand()).toBe(
            'git switch main'
        )
    })

    it('builds -c with start-point branch', () => {
        expect(
            new GitSwitchCliHandler('/repo', {
                branch: 'main',
                create: 'feature/x',
            }).getCommand()
        ).toBe('git switch -c feature/x main')
    })

    it('builds -C with start-point branch', () => {
        expect(
            new GitSwitchCliHandler('/repo', {
                branch: 'main',
                forceCreate: 'feature/x',
            }).getCommand()
        ).toBe('git switch -C feature/x main')
    })

    it('builds -c without start-point (defaults to HEAD)', () => {
        expect(
            new GitSwitchCliHandler('/repo', { create: 'feature/x' }).getCommand()
        ).toBe('git switch -c feature/x')
    })

    it('builds --track flag', () => {
        expect(
            new GitSwitchCliHandler('/repo', { branch: 'main', track: true }).getCommand()
        ).toBe('git switch --track main')
    })

    it('builds combined flags', () => {
        expect(
            new GitSwitchCliHandler('/repo', {
                branch: 'develop',
                force: true,
                discardChanges: true,
                quiet: true,
            }).getCommand()
        ).toBe('git switch --force --discard-changes --quiet develop')
    })

    it('quotes values with spaces', () => {
        expect(quoteArg('my branch')).toBe('"my branch"')
        expect(
            new GitSwitchCliHandler('/repo', { branch: 'my branch' }).getCommand()
        ).toBe('git switch "my branch"')
    })

    it('executes with cwd', async () => {
        execMock.mockImplementation((_cmd, opts, callback) => {
            expect(opts.cwd).toBe('/repo')
            callback(null, '', '')
        })

        await new GitSwitchCliHandler('/repo', { branch: 'main' }).execute()
        expect(execMock).toHaveBeenCalledWith(
            'git switch main',
            expect.objectContaining({ cwd: '/repo' }),
            expect.any(Function)
        )
    })
})

describe('argvToSwitchOptions', () => {
    it('maps short aliases -c/-C/-f/-m/-t/-q', () => {
        const opts = argvToSwitchOptions({
            branch: 'main',
            c: 'feature/x',
            f: true,
            m: false,
            t: true,
            q: true,
        })
        expect(opts.create).toBe('feature/x')
        expect(opts.force).toBe(true)
        expect(opts.track).toBe(true)
        expect(opts.quiet).toBe(true)
    })

    it('maps kebab-case booleans', () => {
        const opts = argvToSwitchOptions({
            branch: 'develop',
            'discard-changes': true,
            'no-track': true,
            'no-guess': true,
        })
        expect(opts.discardChanges).toBe(true)
        expect(opts.noTrack).toBe(true)
        expect(opts.noGuess).toBe(true)
    })
})

describe('switch validation (repos vs --all/--interactive)', () => {
    it('rejects repos together with --all', () => {
        expect(() =>
            checkSwitchArgs({ repos: ['./repo1'], all: true, interactive: false })
        ).toThrow('Нельзя указывать рабочие копии вместе с --all или --interactive')
    })

    it('rejects repos together with --interactive', () => {
        expect(() =>
            checkSwitchArgs({ repos: ['./repo1'], all: false, interactive: true })
        ).toThrow('Нельзя указывать рабочие копии вместе с --all или --interactive')
    })

    it('requires repos, --all or --interactive', () => {
        expect(() =>
            checkSwitchArgs({ repos: [], all: false, interactive: false })
        ).toThrow('Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive')
    })

    it('rejects --all with --interactive', () => {
        expect(() =>
            checkSwitchArgs({ repos: [], all: true, interactive: true })
        ).toThrow('Опции --interactive и --all не могут использоваться вместе')
    })

    it('accepts repos without flags and branch is not counted as a copy', () => {
        expect(
            checkSwitchArgs({ branch: 'main', repos: ['./repo1'], all: false, interactive: false })
        ).toBe(true)
        expect(checkSwitchArgs({ branch: 'main', repos: [], all: true, interactive: false })).toBe(true)
    })

    it('branch alone is not a copy selection', () => {
        expect(checkSwitchArgs({ branch: 'main', repos: [], all: true, interactive: false })).toBe(true)
        expect(() =>
            checkSwitchArgs({ branch: 'main', repos: [], all: false, interactive: false })
        ).toThrow('Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive')
    })

    it('requires branch unless -c/-C is given', () => {
        expect(() =>
            checkSwitchArgs({ repos: ['./repo1'], all: false, interactive: false })
        ).toThrow('Не указана ветка. Укажите <branch> или используйте -c/-C для создания новой ветки')
        expect(
            checkSwitchArgs({ repos: [], all: true, interactive: false, c: 'feature/x' })
        ).toBe(true)
        expect(
            checkSwitchArgs({ branch: 'main', repos: [], all: true, interactive: false })
        ).toBe(true)
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
        expect(() => checks[0]({ branch: 'main', repos: [], all: false, interactive: false })).toThrow(
            'Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive'
        )
    })
})

describe('workspace parent builder (--repos/-r)', () => {
    function captureBuilder() {
        const captured: { options: Record<string, any>; checks: Array<(argv: any) => boolean> } = {
            options: {},
            checks: [],
        }
        const fakeY: any = {
            usage() {
                return this
            },
            options(opts: Record<string, any>) {
                Object.assign(captured.options, opts)
                return this
            },
            check(fn: (argv: any) => boolean) {
                captured.checks.push(fn)
                return this
            },
            commandDir() {
                return this
            },
            demandCommand() {
                return this
            },
            epilog() {
                return this
            },
            showHelpOnFail() {
                return this
            },
        }
        workspaceBuilder(fakeY)
        return captured
    }

    it('registers --repos/-r as array option with empty default', () => {
        const { options } = captureBuilder()
        expect(options.repos).toMatchObject({ type: 'string', array: true, default: [] })
        expect(options.repos.alias).toContain('r')
    })

    it('rejects repos together with --all/--interactive at parent level', () => {
        const { checks } = captureBuilder()
        expect(checks).toHaveLength(1)
        expect(() => checks[0]({ repos: ['a'], all: true, interactive: false })).toThrow(
            'Нельзя указывать рабочие копии вместе с --all или --interactive'
        )
        expect(() => checks[0]({ repos: ['a'], all: false, interactive: true })).toThrow(
            'Нельзя указывать рабочие копии вместе с --all или --interactive'
        )
        expect(checks[0]({ repos: ['a'], all: false, interactive: false })).toBe(true)
        expect(checks[0]({ repos: [], all: true, interactive: false })).toBe(true)
    })
})

describe('resolveWorkspaceCopies with repos', () => {
    let tmpRoot: string

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-repos-'))
    })

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true })
    })

    function makeCopy(rel: string): string {
        const abs = path.join(tmpRoot, rel)
        fs.mkdirSync(path.join(abs, '.git'), { recursive: true })
        return abs
    }

    it('resolves relative repos against dir, not CWD', async () => {
        const abs = makeCopy('repo1')
        // cwd тестов (корень репозитория) заведомо != tmpRoot
        expect(path.resolve('repo1')).not.toBe(abs)
        const copies = await resolveWorkspaceCopies({
            dir: tmpRoot,
            all: false,
            interactive: false,
            repos: ['repo1'],
        })
        expect(copies).toEqual([abs])
    })

    it('resolves absolute repos paths', async () => {
        const abs = makeCopy('repo2')
        const copies = await resolveWorkspaceCopies({
            dir: tmpRoot,
            all: false,
            interactive: false,
            repos: [abs],
        })
        expect(copies).toEqual([abs])
    })

    it('rejects repos together with --all', async () => {
        makeCopy('repo1')
        await expect(
            resolveWorkspaceCopies({ dir: tmpRoot, all: true, interactive: false, repos: ['repo1'] })
        ).rejects.toThrow('Нельзя указывать рабочие копии вместе с --all или --interactive')
    })

    it('requires repos, --all or --interactive', async () => {
        await expect(
            resolveWorkspaceCopies({ dir: tmpRoot, all: false, interactive: false, repos: [] })
        ).rejects.toThrow('Не указаны рабочие копии. Укажите пути через --repos или используйте --all или --interactive')
    })

    it('rejects non-working-copy repos path', async () => {
        await expect(
            resolveWorkspaceCopies({ dir: tmpRoot, all: false, interactive: false, repos: ['nope'] })
        ).rejects.toThrow('Не является рабочей копией git: nope')
    })
})
