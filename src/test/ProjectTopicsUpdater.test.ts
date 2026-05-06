import { ProjectDTO } from '../main/common/DTO/Project'
import { planProjectTopicUpdates, ProjectTopicsUpdater } from '../main/services/ProjectTopicsUpdater'

function p(id: number, path: string, topics: string[]): ProjectDTO {
    return { id, path_with_namespace: path, topics } as ProjectDTO
}

describe('planProjectTopicUpdates', () => {
    describe('add', () => {
        it('returns empty when all topics already present', () => {
            const projects = [p(1, 'g/a', ['x', 'y'])]
            expect(planProjectTopicUpdates(projects, 'add', ['x', 'y'])).toEqual([])
        })

        it('appends only missing topics in original order', () => {
            const projects = [p(1, 'g/a', ['a'])]
            const out = planProjectTopicUpdates(projects, 'add', ['b', 'a'])
            expect(out).toHaveLength(1)
            expect(out[0].topics).toEqual(['a', 'b'])
            expect(projects[0].topics).toEqual(['a'])
        })

        it('updates only projects that gain new topics', () => {
            const projects = [p(1, 'g/one', ['t']), p(2, 'g/two', ['t', 'u'])]
            const out = planProjectTopicUpdates(projects, 'add', ['u'])
            expect(out).toHaveLength(1)
            expect(out[0].id).toBe(1)
            expect(out[0].topics).toEqual(['t', 'u'])
        })

        it('returns empty when topics argument is empty', () => {
            const projects = [p(1, 'g/a', ['a'])]
            expect(planProjectTopicUpdates(projects, 'add', [])).toEqual([])
        })

        it('returns empty when topics argument is undefined', () => {
            const projects = [p(1, 'g/a', ['a'])]
            expect(planProjectTopicUpdates(projects, 'add', undefined)).toEqual([])
        })
    })

    describe('remove', () => {
        it('excludes project when no topic matches', () => {
            const projects = [p(1, 'g/a', ['a', 'b'])]
            expect(planProjectTopicUpdates(projects, 'remove', ['z'])).toEqual([])
        })

        it('removes matching topics and preserves order of the rest', () => {
            const projects = [p(1, 'g/a', ['a', 'b', 'c'])]
            const out = planProjectTopicUpdates(projects, 'remove', ['b'])
            expect(out[0].topics).toEqual(['a', 'c'])
        })

        it('excludes project when topics list is empty', () => {
            const projects = [p(1, 'g/a', ['a'])]
            expect(planProjectTopicUpdates(projects, 'remove', [])).toEqual([])
        })

        it('excludes project when project has no topics', () => {
            const projects = [p(1, 'g/a', [])]
            expect(planProjectTopicUpdates(projects, 'remove', ['a'])).toEqual([])
        })

        it('can remove all topics', () => {
            const projects = [p(1, 'g/a', ['x', 'y'])]
            const out = planProjectTopicUpdates(projects, 'remove', ['x', 'y'])
            expect(out[0].topics).toEqual([])
        })
    })

    describe('clear', () => {
        it('excludes projects that already have no topics', () => {
            const projects = [p(1, 'g/a', [])]
            expect(planProjectTopicUpdates(projects, 'clear', undefined)).toEqual([])
        })

        it('clears non-empty topics', () => {
            const projects = [p(1, 'g/a', ['x'])]
            const out = planProjectTopicUpdates(projects, 'clear', undefined)
            expect(out[0].topics).toEqual([])
        })
    })
})

describe('ProjectTopicsUpdater', () => {
    it('calls updateProjectData for each planned project', async () => {
        const gitlab = { updateProjectData: jest.fn().mockResolvedValue(undefined) }
        const updater = new ProjectTopicsUpdater(gitlab, 'skip', 3)
        const projects = [p(1, 'g/one', ['a']), p(2, 'g/two', ['a', 'b'])]
        await updater.execute(projects, 'remove', ['b'])
        expect(gitlab.updateProjectData).toHaveBeenCalledTimes(1)
        expect(gitlab.updateProjectData).toHaveBeenCalledWith(2, { topics: ['a'] })
    })

    it('does not call API when nothing to update', async () => {
        const gitlab = { updateProjectData: jest.fn().mockResolvedValue(undefined) }
        const updater = new ProjectTopicsUpdater(gitlab, 'skip', 3)
        await updater.execute([p(1, 'g/a', ['t'])], 'add', ['t'])
        expect(gitlab.updateProjectData).not.toHaveBeenCalled()
    })
})
