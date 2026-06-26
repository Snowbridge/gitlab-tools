import * as fs from 'fs'
import * as path from 'path'
import { GitlabGroupDTO } from '../common/DTO/Gitlab/GroupDTO'
import { GitlabProjectDTO } from '../common/DTO/Gitlab/ProjectDTO'
import { GitlabUserDTO } from '../common/DTO/Gitlab/UserDTO'
import { GitlabHttpError } from '../common/GitlabHttpError'
import { ProcessableElementsQueue } from '../common/ProcessableElementsQueue'
import { ProcessingSkippedError } from '../common/ProcessingSkippedError'
import { RemoteSetupStrategy } from './RemoteSetupStrategies/RemoteSetupStrategy'

export type ExistingRemoteBehaviour = 'rename' | 'replace' | 'skip'

export type PublishTarget = {
    localPath: string
    projectName: string
    groupSegments: string[]
    pathWithNamespace: string
    namespaceKind: 'group' | 'personal'
}

export type GitlabPublishClient = {
    getGroup(fullPath: string): Promise<GitlabGroupDTO | null>
    createGroup(params: { name: string; path: string; parent_id?: number }): Promise<GitlabGroupDTO>
    getProjectByPath(pathWithNamespace: string): Promise<GitlabProjectDTO | null>
    createProject(params: { name: string; path?: string; namespace_id?: number }): Promise<GitlabProjectDTO>
    getCurrentUser(): Promise<GitlabUserDTO>
}

export type GitRemoteExecutor = {
    remoteExists(localPath: string, name: string): Promise<boolean>
    getRemoteUrl(localPath: string, name: string): Promise<string | null>
    renameRemote(localPath: string, from: string, to: string): Promise<void>
    removeRemote(localPath: string, name: string): Promise<void>
    addRemote(localPath: string, name: string, url: string): Promise<void>
    pushAll(localPath: string, remoteName: string): Promise<void>
}

export function isWorkingCopyRoot(dir: string): boolean {
    const gitPath = path.join(dir, '.git')
    return fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()
}

export function findWorkingCopyGitDirs(rootDir: string): string[] {
    const result: string[] = []

    function walk(dir: string): void {
        let entries: fs.Dirent[]
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
            return
        }

        for (const entry of entries) {
            if (entry.name === '.git' && entry.isDirectory()) {
                result.push(path.join(dir, '.git'))
                continue
            }
            if (entry.isDirectory()) {
                walk(path.join(dir, entry.name))
            }
        }
    }

    walk(rootDir)
    return result
}

export function computePublishTarget(
    rootDir: string,
    repoRoot: string,
    rootGroup: string | null
): PublishTarget {
    const rel = path.relative(rootDir, repoRoot)
    const segments = rel === '' ? [] : rel.split(path.sep).filter(Boolean)
    const projectName = path.basename(repoRoot)
    const groupSegments = segments.slice(0, -1)

    if (!rootGroup) {
        return {
            localPath: repoRoot,
            projectName,
            groupSegments,
            pathWithNamespace: projectName,
            namespaceKind: 'personal',
        }
    }

    const pathWithNamespace = groupSegments.length
        ? `${rootGroup}/${groupSegments.join('/')}/${projectName}`
        : `${rootGroup}/${projectName}`

    return {
        localPath: repoRoot,
        projectName,
        groupSegments,
        pathWithNamespace,
        namespaceKind: 'group',
    }
}

export function planNestedGroupPaths(rootGroup: string, groupSegments: string[]): string[] {
    const paths: string[] = []
    let current = rootGroup
    for (const segment of groupSegments) {
        current = `${current}/${segment}`
        paths.push(current)
    }
    return paths
}

export function buildSshRemoteUrl(host: string, port: number, pathWithNamespace: string): string {
    return `ssh://git@${host}:${port}/${pathWithNamespace}.git`
}

export function normalizeHost(host: string): string {
    return host
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .replace(/:\d+$/, '')
        .toLowerCase()
}

export function extractRemoteHost(remoteUrl: string): string | null {
    const trimmed = remoteUrl.trim()
    if (!trimmed)
        return null

    const sshUrlMatch = trimmed.match(/^ssh:\/\/(?:[^@]+@)?([^/:]+)(?::\d+)?/i)
    if (sshUrlMatch)
        return normalizeHost(sshUrlMatch[1])

    const scpMatch = trimmed.match(/^[^@]+@([^:/]+)/)
    if (scpMatch)
        return normalizeHost(scpMatch[1])

    const httpsMatch = trimmed.match(/^https?:\/\/([^/:]+)/i)
    if (httpsMatch)
        return normalizeHost(httpsMatch[1])

    return null
}

export function remoteHostMatchesConfig(remoteUrl: string, configHost: string): boolean {
    const remoteHost = extractRemoteHost(remoteUrl)
    if (!remoteHost)
        return false
    return remoteHost === normalizeHost(configHost)
}

export function discoverPublishTargets(dir: string, rootGroup: string | null): PublishTarget[] {
    const normalizedDir = path.normalize(path.resolve(dir))

    if (isWorkingCopyRoot(normalizedDir))
        return [computePublishTarget(normalizedDir, normalizedDir, rootGroup)]

    const gitDirs = findWorkingCopyGitDirs(normalizedDir)
    return gitDirs.map((gitDir) => {
        const repoRoot = path.dirname(gitDir)
        return computePublishTarget(normalizedDir, repoRoot, rootGroup)
    })
}

async function getOrCreateGroup(
    client: GitlabPublishClient,
    cache: Map<string, GitlabGroupDTO>,
    fullPath: string,
    parentId: number | undefined,
    segment: string
): Promise<GitlabGroupDTO> {
    const cached = cache.get(fullPath)
    if (cached)
        return cached

    let group = await client.getGroup(fullPath)
    if (!group) {
        try {
            group = await client.createGroup({
                name: segment,
                path: segment,
                parent_id: parentId,
            })
        } catch (error) {
            if (error instanceof GitlabHttpError && (error.status === 400 || error.status === 409)) {
                group = await client.getGroup(fullPath)
                if (!group)
                    throw error
            } else {
                throw error
            }
        }
    }

    cache.set(fullPath, group)
    return group
}

async function getOrCreateProject(
    client: GitlabPublishClient,
    target: PublishTarget,
    namespaceId?: number
): Promise<GitlabProjectDTO> {
    let project = await client.getProjectByPath(target.pathWithNamespace)
    if (!project) {
        try {
            const createParams = target.namespaceKind === 'personal'
                ? { name: target.projectName }
                : {
                    name: target.projectName,
                    path: target.projectName,
                    namespace_id: namespaceId!,
                }
            project = await client.createProject(createParams)
        } catch (error) {
            if (error instanceof GitlabHttpError && (error.status === 400 || error.status === 409)) {
                project = await client.getProjectByPath(target.pathWithNamespace)
                if (!project)
                    throw error
            } else {
                throw error
            }
        }
    }
    return project
}

export class GitPublisher {
    private client: GitlabPublishClient
    private git: GitRemoteExecutor
    private configHost: string
    private sshPort: number
    private rootGroup: string | null
    private remoteName: string
    private existing: ExistingRemoteBehaviour
    private replaceSuffix: string
    private onError: 'abort' | 'retry' | 'skip'
    private retries: number
    private groupCache = new Map<string, GitlabGroupDTO>()
    private currentUser: GitlabUserDTO | null = null

    constructor(
        client: GitlabPublishClient,
        git: GitRemoteExecutor,
        configHost: string,
        sshPort: number,
        rootGroup: string | null,
        remoteName: string,
        existing: ExistingRemoteBehaviour,
        replaceSuffix: string,
        onError: 'abort' | 'retry' | 'skip',
        retries: number
    ) {
        this.client = client
        this.git = git
        this.configHost = configHost
        this.sshPort = sshPort
        this.rootGroup = rootGroup
        this.remoteName = remoteName
        this.existing = existing
        this.replaceSuffix = replaceSuffix
        this.onError = onError
        this.retries = retries
    }

    async execute(targets: PublishTarget[]): Promise<void> {
        if (targets.length === 0)
            throw new Error('Не найдено ни одной рабочей копии git')

        const queue = new ProcessableElementsQueue<PublishTarget>(
            targets,
            this.onError,
            this.retries,
            (target) => target.pathWithNamespace
        )

        await queue.executeProcessing(async (target) => {
            await this.publishTarget(target)
        })
    }

    private async publishTarget(target: PublishTarget): Promise<void> {
        if (this.existing === 'skip' && await this.git.remoteExists(target.localPath, this.remoteName)) {
            throw new ProcessingSkippedError(
                ` 〰️ ${target.pathWithNamespace}: remote «${this.remoteName}» уже существует, пропущено`
            )
        }

        let pathWithNamespace = target.pathWithNamespace
        let namespaceId: number | undefined

        if (target.namespaceKind === 'personal') {
            const user = await this.ensureCurrentUser()
            pathWithNamespace = `${user.username}/${target.projectName}`
        } else {
            namespaceId = await this.ensureNamespaceId(target)
        }

        await getOrCreateProject(this.client, { ...target, pathWithNamespace }, namespaceId)

        const remoteUrl = buildSshRemoteUrl(this.configHost, this.sshPort, pathWithNamespace)
        const remoteExists = await this.git.remoteExists(target.localPath, this.remoteName)
        const currentRemoteUrl = remoteExists
            ? await this.git.getRemoteUrl(target.localPath, this.remoteName)
            : null

        const strategy = RemoteSetupStrategy.resolve(
            remoteExists, currentRemoteUrl, this.configHost, this.existing
        )
        await strategy.apply(this.git, {
            localPath: target.localPath,
            remoteName: this.remoteName,
            remoteUrl,
            replaceSuffix: this.replaceSuffix,
        })

        await this.git.pushAll(target.localPath, this.remoteName)
    }

    private async ensureNamespaceId(target: PublishTarget): Promise<number> {
        const rootGroup = await this.ensureRootGroup()
        let parentId = rootGroup.id

        for (const groupPath of planNestedGroupPaths(this.rootGroup!, target.groupSegments)) {
            const segment = groupPath.split('/').pop()!
            const group = await getOrCreateGroup(this.client, this.groupCache, groupPath, parentId, segment)
            parentId = group.id
        }

        return parentId
    }

    private async ensureRootGroup(): Promise<GitlabGroupDTO> {
        const segments = this.rootGroup!.split('/').filter(Boolean)
        let parentId: number | undefined = undefined
        let currentPath = ''
        let group: GitlabGroupDTO | null = null

        for (const segment of segments) {
            currentPath = currentPath ? `${currentPath}/${segment}` : segment
            group = await getOrCreateGroup(this.client, this.groupCache, currentPath, parentId, segment)
            parentId = group.id
        }

        if (!group)
            throw new Error(`Не удалось разрешить группу ${this.rootGroup}`)

        return group
    }

    private async ensureCurrentUser(): Promise<GitlabUserDTO> {
        if (!this.currentUser)
            this.currentUser = await this.client.getCurrentUser()
        return this.currentUser
    }
}
