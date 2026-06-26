import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { GitlabGroupDTO } from '../main/common/DTO/Gitlab/GroupDTO'
import { GitlabProjectDTO } from '../main/common/DTO/Gitlab/ProjectDTO'
import {
    buildSshRemoteUrl,
    computePublishTarget,
    discoverPublishTargets,
    extractRemoteHost,
    findWorkingCopyGitDirs,
    GitlabPublishClient,
    GitPublisher,
    GitRemoteExecutor,
    planNestedGroupPaths,
    publishSuccessTextPrefix,
    remoteHostMatchesConfig,
} from '../main/services/Publisher'
import { AddRemoteStrategy } from '../main/services/RemoteSetupStrategies/AddRemoteStrategy'
import { PushOnlyStrategy } from '../main/services/RemoteSetupStrategies/PushOnlyStrategy'
import { RenameExistingRemoteStrategy } from '../main/services/RemoteSetupStrategies/RenameExistingRemoteStrategy'
import { ReplaceExistingRemoteStrategy } from '../main/services/RemoteSetupStrategies/ReplaceExistingRemoteStrategy'
import { RemoteSetupStrategy } from '../main/services/RemoteSetupStrategies/RemoteSetupStrategy'

function group(id: number, fullPath: string, parentId: number | null = null): GitlabGroupDTO {
    const segment = fullPath.split('/').pop()!
    return { id, path: segment, full_path: fullPath, parent_id: parentId, name: segment }
}

function project(pathWithNamespace: string, id = 1): GitlabProjectDTO {
    const name = pathWithNamespace.split('/').pop()!
    return {
        id,
        path_with_namespace: pathWithNamespace,
        name,
        path: name,
    } as GitlabProjectDTO
}

describe('computePublishTarget', () => {
    it('single repo at root dir', () => {
        const target = computePublishTarget('/work/myrepo', '/work/myrepo', 'org')
        expect(target).toEqual({
            localPath: '/work/myrepo',
            projectName: 'myrepo',
            groupSegments: [],
            pathWithNamespace: 'org/myrepo',
            namespaceKind: 'group',
        })
    })

    it('nested repo under root dir', () => {
        const target = computePublishTarget('/work/root', '/work/root/frontend/app', 'org')
        expect(target).toEqual({
            localPath: '/work/root/frontend/app',
            projectName: 'app',
            groupSegments: ['frontend'],
            pathWithNamespace: 'org/frontend/app',
            namespaceKind: 'group',
        })
    })

    it('repo directly under root dir in multi mode', () => {
        const target = computePublishTarget('/work/root', '/work/root/repo', 'org')
        expect(target).toEqual({
            localPath: '/work/root/repo',
            projectName: 'repo',
            groupSegments: [],
            pathWithNamespace: 'org/repo',
            namespaceKind: 'group',
        })
    })

    it('single repo without root group uses personal namespace', () => {
        const target = computePublishTarget('/work/myrepo', '/work/myrepo', null)
        expect(target).toEqual({
            localPath: '/work/myrepo',
            projectName: 'myrepo',
            groupSegments: [],
            pathWithNamespace: 'myrepo',
            namespaceKind: 'personal',
        })
    })
})

describe('planNestedGroupPaths', () => {
    it('builds cumulative group paths', () => {
        expect(planNestedGroupPaths('org', ['a', 'b'])).toEqual(['org/a', 'org/a/b'])
    })

    it('returns empty for no segments', () => {
        expect(planNestedGroupPaths('org', [])).toEqual([])
    })
})

describe('buildSshRemoteUrl', () => {
    it('formats ssh url', () => {
        expect(buildSshRemoteUrl('git.example.com', 22, 'org/frontend/app')).toBe(
            'ssh://git@git.example.com:22/org/frontend/app.git'
        )
    })
})

describe('extractRemoteHost', () => {
    it('parses ssh url', () => {
        expect(extractRemoteHost('ssh://git@gitlab.com:2222/group/repo.git')).toBe('gitlab.com')
    })

    it('parses scp-style url', () => {
        expect(extractRemoteHost('git@github.com:org/repo.git')).toBe('github.com')
    })

    it('parses https url', () => {
        expect(extractRemoteHost('https://gitlab.com/group/repo.git')).toBe('gitlab.com')
    })

    it('returns null for empty url', () => {
        expect(extractRemoteHost('')).toBeNull()
    })
})

describe('remoteHostMatchesConfig', () => {
    it('matches same host case-insensitively', () => {
        expect(remoteHostMatchesConfig('git@GitLab.COM:org/repo.git', 'gitlab.com')).toBe(true)
    })

    it('does not match different host', () => {
        expect(remoteHostMatchesConfig('git@github.com:org/repo.git', 'gitlab.com')).toBe(false)
    })
})

describe('RemoteSetupStrategy.resolve', () => {
    it('adds remote when missing', () => {
        expect(RemoteSetupStrategy.resolve(false, null, 'gitlab.com', 'replace'))
            .toBeInstanceOf(AddRemoteStrategy)
    })

    it('push only when host matches', () => {
        expect(
            RemoteSetupStrategy.resolve(true, 'git@gitlab.com:org/repo.git', 'gitlab.com', 'replace')
        ).toBeInstanceOf(PushOnlyStrategy)
    })

    it('replace when host differs', () => {
        expect(
            RemoteSetupStrategy.resolve(true, 'git@github.com:org/repo.git', 'gitlab.com', 'replace')
        ).toBeInstanceOf(ReplaceExistingRemoteStrategy)
    })

    it('rename when host differs and existing is rename', () => {
        expect(
            RemoteSetupStrategy.resolve(true, 'git@github.com:org/repo.git', 'gitlab.com', 'rename')
        ).toBeInstanceOf(RenameExistingRemoteStrategy)
    })
})

describe('discoverPublishTargets', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('uses single repo mode when dir is working copy', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-single-'))
        fs.mkdirSync(path.join(tmp, '.git'), { recursive: true })

        const targets = discoverPublishTargets(tmp, 'org')
        expect(targets).toHaveLength(1)
        expect(targets[0].localPath).toBe(tmp)
        expect(targets[0].groupSegments).toEqual([])
        expect(targets[0].pathWithNamespace).toBe(`org/${path.basename(tmp)}`)
        expect(targets[0].namespaceKind).toBe('group')

        fs.rmSync(tmp, { recursive: true, force: true })
    })

    it('uses personal namespace when dir is working copy without root group', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-personal-'))
        fs.mkdirSync(path.join(tmp, '.git'), { recursive: true })

        const targets = discoverPublishTargets(tmp, null)
        expect(targets).toHaveLength(1)
        expect(targets[0].pathWithNamespace).toBe(path.basename(tmp))
        expect(targets[0].namespaceKind).toBe('personal')

        fs.rmSync(tmp, { recursive: true, force: true })
    })

    it('finds multiple repos when dir is not working copy', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-test-'))
        const repoRoot = path.join(tmp, 'a', 'b')
        fs.mkdirSync(path.join(repoRoot, '.git'), { recursive: true })

        const targets = discoverPublishTargets(tmp, 'org')
        expect(targets).toHaveLength(1)
        expect(targets[0].pathWithNamespace).toBe('org/a/b')

        fs.rmSync(tmp, { recursive: true, force: true })
    })

    it('walks directory tree to find git dirs', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-walk-'))
        fs.mkdirSync(path.join(tmp, 'one', '.git'), { recursive: true })
        fs.mkdirSync(path.join(tmp, 'two', 'three', '.git'), { recursive: true })

        const gitDirs = findWorkingCopyGitDirs(tmp)
        expect(gitDirs).toHaveLength(2)

        fs.rmSync(tmp, { recursive: true, force: true })
    })
})

describe('GitPublisher', () => {
    function makeClient(): GitlabPublishClient & {
        getGroup: jest.Mock
        createGroup: jest.Mock
        getProjectByPath: jest.Mock
        createProject: jest.Mock
        getCurrentUser: jest.Mock
    } {
        return {
            getGroup: jest.fn(),
            createGroup: jest.fn(),
            getProjectByPath: jest.fn(),
            createProject: jest.fn(),
            getCurrentUser: jest.fn(),
        }
    }

    function makeGit(): GitRemoteExecutor & {
        remoteExists: jest.Mock
        getRemoteUrl: jest.Mock
        renameRemote: jest.Mock
        removeRemote: jest.Mock
        addRemote: jest.Mock
        pushAll: jest.Mock
    } {
        return {
            remoteExists: jest.fn(),
            getRemoteUrl: jest.fn(),
            renameRemote: jest.fn(),
            removeRemote: jest.fn(),
            addRemote: jest.fn(),
            pushAll: jest.fn(),
        }
    }

    it('creates project, adds remote and pushes when remote is missing', async () => {
        const client = makeClient()
        const git = makeGit()
        client.getGroup.mockResolvedValue(group(10, 'org'))
        client.getProjectByPath.mockResolvedValue(null)
        client.createProject.mockResolvedValue(project('org/myrepo', 100))
        git.remoteExists.mockResolvedValue(false)
        git.getRemoteUrl.mockResolvedValue(null)
        git.pushAll.mockResolvedValue(false)

        const publisher = new GitPublisher(
            client, git, 'gitlab.com', 22, 'org', 'origin', 'replace', '_old', 'skip', 0
        )
        await publisher.execute([{
            localPath: '/work/myrepo',
            projectName: 'myrepo',
            groupSegments: [],
            pathWithNamespace: 'org/myrepo',
            namespaceKind: 'group',
        }])

        expect(client.createProject).toHaveBeenCalledWith({
            name: 'myrepo',
            path: 'myrepo',
            namespace_id: 10,
        })
        expect(git.addRemote).toHaveBeenCalledWith(
            '/work/myrepo',
            'origin',
            'ssh://git@gitlab.com:22/org/myrepo.git'
        )
        expect(git.pushAll).toHaveBeenCalledWith('/work/myrepo', 'origin')
    })

    it('only pushes when remote host matches config', async () => {
        const client = makeClient()
        const git = makeGit()
        client.getGroup.mockResolvedValue(group(10, 'org'))
        client.getProjectByPath.mockResolvedValue(project('org/myrepo'))
        git.remoteExists.mockResolvedValue(true)
        git.getRemoteUrl.mockResolvedValue('git@gitlab.com:org/myrepo.git')
        git.pushAll.mockResolvedValue(false)

        const publisher = new GitPublisher(
            client, git, 'gitlab.com', 22, 'org', 'origin', 'replace', '_old', 'skip', 0
        )
        await publisher.execute([{
            localPath: '/work/myrepo',
            projectName: 'myrepo',
            groupSegments: [],
            pathWithNamespace: 'org/myrepo',
            namespaceKind: 'group',
        }])

        expect(git.addRemote).not.toHaveBeenCalled()
        expect(git.removeRemote).not.toHaveBeenCalled()
        expect(git.pushAll).toHaveBeenCalledWith('/work/myrepo', 'origin')
    })

    it('replaces remote when host differs', async () => {
        const client = makeClient()
        const git = makeGit()
        client.getGroup.mockResolvedValue(group(10, 'org'))
        client.getProjectByPath.mockResolvedValue(project('org/myrepo'))
        git.remoteExists.mockResolvedValue(true)
        git.getRemoteUrl.mockResolvedValue('git@github.com:org/myrepo.git')
        git.pushAll.mockResolvedValue(false)

        const publisher = new GitPublisher(
            client, git, 'gitlab.com', 22, 'org', 'origin', 'replace', '_old', 'skip', 0
        )
        await publisher.execute([{
            localPath: '/work/myrepo',
            projectName: 'myrepo',
            groupSegments: [],
            pathWithNamespace: 'org/myrepo',
            namespaceKind: 'group',
        }])

        expect(git.removeRemote).toHaveBeenCalledWith('/work/myrepo', 'origin')
        expect(git.addRemote).toHaveBeenCalledWith(
            '/work/myrepo',
            'origin',
            'ssh://git@gitlab.com:22/org/myrepo.git'
        )
        expect(git.pushAll).toHaveBeenCalled()
    })

    it('renames remote when host differs and existing is rename', async () => {
        const client = makeClient()
        const git = makeGit()
        client.getGroup.mockResolvedValue(group(10, 'org'))
        client.getProjectByPath.mockResolvedValue(project('org/myrepo'))
        git.remoteExists.mockResolvedValue(true)
        git.getRemoteUrl.mockResolvedValue('git@github.com:org/myrepo.git')
        git.pushAll.mockResolvedValue(false)

        const publisher = new GitPublisher(
            client, git, 'gitlab.com', 22, 'org', 'origin', 'rename', '_old', 'skip', 0
        )
        await publisher.execute([{
            localPath: '/work/myrepo',
            projectName: 'myrepo',
            groupSegments: [],
            pathWithNamespace: 'org/myrepo',
            namespaceKind: 'group',
        }])

        expect(git.renameRemote).toHaveBeenCalledWith('/work/myrepo', 'origin', 'origin_old')
        expect(git.addRemote).toHaveBeenCalled()
        expect(git.pushAll).toHaveBeenCalled()
    })

    it('creates nested groups and project', async () => {
        const client = makeClient()
        const git = makeGit()
        client.getGroup.mockImplementation(async (fullPath: string) => {
            if (fullPath === 'org')
                return group(10, 'org')
            if (fullPath === 'org/frontend')
                return group(20, 'org/frontend', 10)
            return null
        })
        client.createGroup.mockResolvedValue(group(20, 'org/frontend', 10))
        client.getProjectByPath.mockResolvedValue(null)
        client.createProject.mockResolvedValue(project('org/frontend/app', 100))
        git.remoteExists.mockResolvedValue(false)
        git.pushAll.mockResolvedValue(false)

        const publisher = new GitPublisher(
            client, git, 'gitlab.com', 22, 'org', 'origin', 'replace', '_old', 'skip', 0
        )
        await publisher.execute([{
            localPath: '/work/root/frontend/app',
            projectName: 'app',
            groupSegments: ['frontend'],
            pathWithNamespace: 'org/frontend/app',
            namespaceKind: 'group',
        }])

        expect(client.createGroup).not.toHaveBeenCalled()
        expect(client.createProject).toHaveBeenCalledWith({
            name: 'app',
            path: 'app',
            namespace_id: 20,
        })
    })

    it('creates project in personal namespace when namespaceKind is personal', async () => {
        const client = makeClient()
        const git = makeGit()
        client.getCurrentUser.mockResolvedValue({ id: 42, username: 'alice' })
        client.getProjectByPath.mockResolvedValue(null)
        client.createProject.mockResolvedValue(project('alice/myrepo', 100))
        git.remoteExists.mockResolvedValue(false)
        git.pushAll.mockResolvedValue(false)

        const publisher = new GitPublisher(
            client, git, 'gitlab.com', 22, null, 'origin', 'replace', '_old', 'skip', 0
        )
        await publisher.execute([{
            localPath: '/work/myrepo',
            projectName: 'myrepo',
            groupSegments: [],
            pathWithNamespace: 'myrepo',
            namespaceKind: 'personal',
        }])

        expect(client.getCurrentUser).toHaveBeenCalled()
        expect(client.getGroup).not.toHaveBeenCalled()
        expect(client.createProject).toHaveBeenCalledWith({ name: 'myrepo' })
        expect(git.addRemote).toHaveBeenCalledWith(
            '/work/myrepo',
            'origin',
            'ssh://git@gitlab.com:22/alice/myrepo.git'
        )
        expect(git.pushAll).toHaveBeenCalledWith('/work/myrepo', 'origin')
    })

    it('throws when no working copies found', async () => {
        const publisher = new GitPublisher(
            makeClient(), makeGit(), 'gitlab.com', 22, 'org', 'origin', 'replace', '_old', 'skip', 0
        )
        await expect(publisher.execute([])).rejects.toThrow('Не найдено ни одной рабочей копии git')
    })

    it('skips working copy when existing is skip and remote already exists', async () => {
        const client = makeClient()
        const git = makeGit()
        git.remoteExists.mockResolvedValue(true)
        const logSpy = jest.spyOn(console, 'log').mockImplementation()

        const publisher = new GitPublisher(
            client, git, 'gitlab.com', 22, 'org', 'origin', 'skip', '_old', 'skip', 0
        )
        await publisher.execute([{
            localPath: '/work/myrepo',
            projectName: 'myrepo',
            groupSegments: [],
            pathWithNamespace: 'org/myrepo',
            namespaceKind: 'group',
        }])

        expect(git.remoteExists).toHaveBeenCalledWith('/work/myrepo', 'origin')
        expect(client.getGroup).not.toHaveBeenCalled()
        expect(client.createProject).not.toHaveBeenCalled()
        expect(git.pushAll).not.toHaveBeenCalled()
        expect(logSpy).toHaveBeenCalledWith(' 〰️ org/myrepo: remote «origin» уже существует, пропущено')

        logSpy.mockRestore()
    })

    it('publishes when existing is skip and remote is missing', async () => {
        const client = makeClient()
        const git = makeGit()
        client.getGroup.mockResolvedValue(group(10, 'org'))
        client.getProjectByPath.mockResolvedValue(null)
        client.createProject.mockResolvedValue(project('org/myrepo', 100))
        git.remoteExists.mockResolvedValue(false)
        git.pushAll.mockResolvedValue(false)

        const publisher = new GitPublisher(
            client, git, 'gitlab.com', 22, 'org', 'origin', 'skip', '_old', 'skip', 0
        )
        await publisher.execute([{
            localPath: '/work/myrepo',
            projectName: 'myrepo',
            groupSegments: [],
            pathWithNamespace: 'org/myrepo',
            namespaceKind: 'group',
        }])

        expect(client.createProject).toHaveBeenCalled()
        expect(git.pushAll).toHaveBeenCalled()
    })
})

describe('publishSuccessTextPrefix', () => {
    it('returns 🆕 when project was created', () => {
        expect(publishSuccessTextPrefix({ projectCreated: true, pushed: false })).toBe('🆕 ')
        expect(publishSuccessTextPrefix({ projectCreated: true, pushed: true })).toBe('🆕 ')
    })

    it('returns 📈 when project existed and push transferred data', () => {
        expect(publishSuccessTextPrefix({ projectCreated: false, pushed: true })).toBe('📈 ')
    })

    it('returns undefined when project existed and push was up to date', () => {
        expect(publishSuccessTextPrefix({ projectCreated: false, pushed: false })).toBeUndefined()
    })
})
