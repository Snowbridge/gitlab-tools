import { gitPushOutputIndicatesTransfer } from '../main/services/GitCliHandlers/gitPushOutputIndicatesTransfer'

describe('gitPushOutputIndicatesTransfer', () => {
    it('returns false when everything is up to date', () => {
        const output = [
            'To ssh://git@gitlab.com:22/org/repo.git',
            'Everything up-to-date',
            'To ssh://git@gitlab.com:22/org/repo.git',
            'Everything up-to-date',
        ].join('\n')

        expect(gitPushOutputIndicatesTransfer(output)).toBe(false)
    })

    it('returns false for "Everything up to date" variant', () => {
        const output = 'To ssh://git@host/repo.git\nEverything up to date\n'

        expect(gitPushOutputIndicatesTransfer(output)).toBe(false)
    })

    it('returns true when a branch was pushed', () => {
        const output = [
            'To ssh://git@gitlab.com:22/org/repo.git',
            '   abc1234..def5678  main -> main',
        ].join('\n')

        expect(gitPushOutputIndicatesTransfer(output)).toBe(true)
    })

    it('returns true for a new branch', () => {
        const output = '* [new branch]      main -> main\n'

        expect(gitPushOutputIndicatesTransfer(output)).toBe(true)
    })

    it('returns true for a new tag', () => {
        const output = '* [new tag]         v1.0 -> v1.0\n'

        expect(gitPushOutputIndicatesTransfer(output)).toBe(true)
    })

    it('returns true when only tags were pushed after branches were up to date', () => {
        const output = [
            'To ssh://git@gitlab.com:22/org/repo.git',
            'Everything up-to-date',
            'To ssh://git@gitlab.com:22/org/repo.git',
            ' * [new tag]         v1.0 -> v1.0',
        ].join('\n')

        expect(gitPushOutputIndicatesTransfer(output)).toBe(true)
    })
})
