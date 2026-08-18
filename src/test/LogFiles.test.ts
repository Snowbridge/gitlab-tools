import fs from 'fs'
import os from 'os'
import path from 'path'
import {
    listLogFileNames,
    readLogLines,
    resolveLogFilePath,
} from '../main/common/LogFiles'

describe('LogFiles', () => {
    let tempDir: string

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlab-tools-log-test-'))
    })

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true })
    })

    describe('listLogFileNames', () => {
        it('should return managed log files sorted by date descending', () => {
            fs.writeFileSync(
                path.join(tempDir, 'gitlab-tools-2026-08-18T09-00-00.000Z.log.json'),
                'old\n',
            )
            fs.writeFileSync(
                path.join(tempDir, 'gitlab-tools-2026-08-18T10-00-00.000Z.log.json'),
                'new\n',
            )
            fs.writeFileSync(path.join(tempDir, 'other-file.json'), 'skip\n')

            expect(listLogFileNames(tempDir)).toEqual([
                'gitlab-tools-2026-08-18T10-00-00.000Z.log.json',
                'gitlab-tools-2026-08-18T09-00-00.000Z.log.json',
            ])
        })
    })

    describe('readLogLines', () => {
        it('should return all lines when lines is undefined', () => {
            const filePath = path.join(tempDir, 'log.json')
            fs.writeFileSync(filePath, 'line1\nline2\nline3\n')

            expect(readLogLines(filePath)).toEqual(['line1', 'line2', 'line3', ''])
        })

        it('should return last N lines', () => {
            const filePath = path.join(tempDir, 'log.json')
            fs.writeFileSync(filePath, 'line1\nline2\nline3\n')

            expect(readLogLines(filePath, 2)).toEqual(['line3', ''])
        })
    })

    describe('resolveLogFilePath', () => {
        it('should resolve basename inside temp directory', () => {
            const fileName = 'gitlab-tools-2026-08-18T09-00-00.000Z.log.json'
            const resolved = resolveLogFilePath(fileName, tempDir)

            expect(resolved).toBe(path.join(tempDir, fileName))
        })

        it('should reject path traversal', () => {
            expect(() => resolveLogFilePath('../outside.log.json', tempDir))
                .toThrow('Недопустимое имя файла лога')
        })

        it('should reject nested paths', () => {
            expect(() => resolveLogFilePath('nested/file.log.json', tempDir))
                .toThrow('Недопустимое имя файла лога')
        })
    })
})
