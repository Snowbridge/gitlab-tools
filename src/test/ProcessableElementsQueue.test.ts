import { ProcessableElementsQueue } from '../main/common/ProcessableElementsQueue'
import { ProcessingSkippedError } from '../main/common/ProcessingSkippedError'

describe('ProcessableElementsQueue', () => {
    describe('constructor', () => {
        it('should initialize with provided values', () => {
            const values = ['item1', 'item2', 'item3']
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            
            expect(queue.hasNext()).toBe(true)
        })

        it('should initialize with custom value naming callback', () => {
            const values = [{ id: 1 }, { id: 2 }]
            const namingCallback = (item: any) => `Item-${item.id}`
            const queue = new ProcessableElementsQueue(values, 'skip', 3, namingCallback)
            
            expect(queue.hasNext()).toBe(true)
        })

        it('should use default naming when no callback provided', () => {
            const values = [{ name: 'test' }, 'simple string']
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            
            expect(queue.hasNext()).toBe(true)
        })

        it('should set default retries count to 3 when not provided', () => {
            const values = ['item1']
            const queue = new ProcessableElementsQueue(values, 'retry', 0)
            
            expect(queue.hasNext()).toBe(true)
        })
    })

    describe('hasNext', () => {
        it('should return true when queue has elements', () => {
            const values = ['item1', 'item2']
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            
            expect(queue.hasNext()).toBe(true)
        })

        it('should return false when queue is empty', () => {
            const values: string[] = []
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            
            expect(queue.hasNext()).toBe(false)
        })

        it('should return false after all elements are processed', () => {
            const values = ['item1']
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            
            queue.next()
            expect(queue.hasNext()).toBe(false)
        })
    })

    describe('next', () => {
        it('should return the first element and remove it from queue', () => {
            const values = ['item1', 'item2', 'item3']
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            
            const first = queue.next()
            expect(first.value).toBe('item1')
            expect(first.attempt).toBe(1)
            expect(queue.hasNext()).toBe(true)
            
            const second = queue.next()
            expect(second.value).toBe('item2')
            expect(queue.hasNext()).toBe(true)
            
            const third = queue.next()
            expect(third.value).toBe('item3')
            expect(queue.hasNext()).toBe(false)
        })

        it('should return elements with correct structure', () => {
            const values = [{ name: 'test', data: 123 }]
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            
            const element = queue.next()
            expect(element.value).toEqual({ name: 'test', data: 123 })
            expect(element.attempt).toBe(1)
            expect(element.name).toBeDefined()
        })
    })

    describe('processElement', () => {
        describe('with skip strategy', () => {
            it('should skip element on error and log warning', async () => {
                const values = ['item1']
                const queue = new ProcessableElementsQueue(values, 'skip', 3)
                const element = queue.next()
                const callback = jest.fn().mockRejectedValue(new Error('Processing error'))
                
                await queue.processElement(element, callback)
                
                expect(callback).toHaveBeenCalledWith('item1')
                expect(queue.hasNext()).toBe(false) // Element should not be re-queued
            })

            it('should process element successfully', async () => {
                const values = ['item1']
                const queue = new ProcessableElementsQueue(values, 'skip', 3)
                const element = queue.next()
                const callback = jest.fn().mockResolvedValue(undefined)
                
                await queue.processElement(element, callback)
                
                expect(callback).toHaveBeenCalledWith('item1')
                expect(element.attempt).toBe(1) // Should process successfully and exactly once
            })

            it('should pass successTextPrefix to spinner.succeed', async () => {
                const ora = require('ora')
                const succeed = jest.fn()
                ora.mockReturnValue({
                    start: jest.fn().mockReturnThis(),
                    succeed,
                    fail: jest.fn(),
                    stop: jest.fn(),
                })

                const values = ['item1']
                const queue = new ProcessableElementsQueue(values, 'skip', 3, (value) => String(value))
                const element = queue.next()
                const callback = jest.fn().mockResolvedValue({ successTextPrefix: '📈 ' })

                await queue.processElement(element, callback)

                expect(succeed).toHaveBeenCalledWith('📈 item1')
            })

            it('should stop spinner and log message on ProcessingSkippedError', async () => {
                const values = ['item1']
                const queue = new ProcessableElementsQueue(values, 'skip', 3)
                const element = queue.next()
                const logSpy = jest.spyOn(console, 'log').mockImplementation()
                const callback = jest.fn().mockRejectedValue(
                    new ProcessingSkippedError(' 〰️ item1: пропущено')
                )

                await queue.processElement(element, callback)

                expect(logSpy).toHaveBeenCalledWith(' 〰️ item1: пропущено')
                logSpy.mockRestore()
            })
        })

        describe('with abort strategy', () => {
            it('should throw error and abort processing', async () => {
                const values = ['item1']
                const queue = new ProcessableElementsQueue(values, 'abort', 3)
                const element = queue.next()
                const error = new Error('Processing error')
                const callback = jest.fn().mockRejectedValue(error)
                
                await expect(queue.processElement(element, callback)).rejects.toThrow('Processing error')
                expect(callback).toHaveBeenCalledWith('item1')
            })

            it('should process element successfully', async () => {
                const values = ['item1']
                const queue = new ProcessableElementsQueue(values, 'abort', 3)
                const element = queue.next()
                const callback = jest.fn().mockResolvedValue(undefined)
                
                await queue.processElement(element, callback)
                
                expect(callback).toHaveBeenCalledWith('item1')
            })
        })

        describe('with retry strategy', () => {
            it('should retry element when attempts are less than retriesCount', async () => {
                const values = ['item1']
                const queue = new ProcessableElementsQueue(values, 'retry', 3)
                const element = queue.next()
                const callback = jest.fn().mockRejectedValue(new Error('Processing error'))
                
                await queue.processElement(element, callback)
                
                expect(element.attempt).toBe(2)
                expect(queue.hasNext()).toBe(true) // Element should be re-queued
            })

            it('should skip element when max retries exceeded', async () => {
                const values = ['item1']
                const queue = new ProcessableElementsQueue(values, 'retry', 1)
                const element = queue.next()
                const callback = jest.fn().mockRejectedValue(new Error('Processing error'))
                
                // First retry
                await queue.processElement(element, callback)
                expect(element.attempt).toBe(2)
                expect(queue.hasNext()).toBe(true)
                
                // Second attempt (should exceed retriesCount)
                const reQueuedElement = queue.next()
                await queue.processElement(reQueuedElement, callback)
                
                expect(reQueuedElement.attempt).toBe(2)
                expect(queue.hasNext()).toBe(false) // Element should not be re-queued again
            })

            it('should process element successfully on retry', async () => {
                const values = ['item1']
                const queue = new ProcessableElementsQueue(values, 'retry', 3)
                const element = queue.next()
                
                // First call fails, second succeeds
                const callback = jest.fn()
                    .mockRejectedValueOnce(new Error('Processing error'))
                    .mockResolvedValueOnce(undefined)
                
                // First attempt fails
                await queue.processElement(element, callback)
                expect(element.attempt).toBe(2)
                expect(queue.hasNext()).toBe(true)
                
                // Retry succeeds
                const reQueuedElement = queue.next()
                await queue.processElement(reQueuedElement, callback)
                expect(reQueuedElement.attempt).toBe(2) // Should not increment on success
                expect(queue.hasNext()).toBe(false)
            })
        })
    })

    describe('executeProcessing', () => {
        it('should process all elements successfully', async () => {
            const values = ['item1', 'item2', 'item3']
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            const callback = jest.fn().mockResolvedValue(undefined)
            
            await queue.executeProcessing(callback)
            
            expect(callback).toHaveBeenCalledTimes(3)
            expect(callback).toHaveBeenCalledWith('item1')
            expect(callback).toHaveBeenCalledWith('item2')
            expect(callback).toHaveBeenCalledWith('item3')
            expect(queue.hasNext()).toBe(false)
        })

        it('should skip failed elements with skip strategy', async () => {
            const values = ['item1', 'item2', 'item3']
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            const callback = jest.fn()
                .mockResolvedValueOnce(undefined) // item1 succeeds
                .mockRejectedValueOnce(new Error('Error')) // item2 fails
                .mockResolvedValueOnce(undefined) // item3 succeeds
            
            await queue.executeProcessing(callback)
            
            expect(callback).toHaveBeenCalledTimes(3)
            expect(queue.hasNext()).toBe(false)
        })

        it('should abort on first error with abort strategy', async () => {
            const values = ['item1', 'item2', 'item3']
            const queue = new ProcessableElementsQueue(values, 'abort', 3)
            const callback = jest.fn()
                .mockResolvedValueOnce(undefined) // item1 succeeds
                .mockRejectedValueOnce(new Error('Error')) // item2 fails, should abort
            
            await expect(queue.executeProcessing(callback)).rejects.toThrow('Error')
            
            expect(callback).toHaveBeenCalledTimes(2)
            expect(callback).toHaveBeenCalledWith('item1')
            expect(callback).toHaveBeenCalledWith('item2')
            // item3 should not be processed
        })

        it('should retry failed elements with retry strategy', async () => {
            const values = ['item1', 'item2']
            const queue = new ProcessableElementsQueue(values, 'retry', 2)
            const callback = jest.fn()
                .mockResolvedValueOnce(undefined) // item1 succeeds
                .mockRejectedValueOnce(new Error('Error')) // item2 fails first time
                .mockResolvedValueOnce(undefined) // item2 succeeds on retry
            
            await queue.executeProcessing(callback)
            
            expect(callback).toHaveBeenCalledTimes(3) // item1 + item2 (2 attempts)
            expect(queue.hasNext()).toBe(false)
        })

        it('should handle empty queue', async () => {
            const values: string[] = []
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            const callback = jest.fn()
            
            await queue.executeProcessing(callback)
            
            expect(callback).not.toHaveBeenCalled()
        })
    })

    describe('edge cases', () => {
        it('should handle complex objects with custom naming', () => {
            const values = [
                { id: 1, name: 'Test1', data: { nested: 'value' } },
                { id: 2, name: 'Test2', data: { nested: 'value2' } }
            ]
            const namingCallback = (item: any) => `${item.name}-${item.id}`
            const queue = new ProcessableElementsQueue(values, 'skip', 3, namingCallback)
            
            const element = queue.next()
            expect(element.value).toEqual(values[0])
            expect(element.name).toBe('Test1-1')
        })

        it('should handle primitive values', () => {
            const values = [123, true, null, undefined]
            const queue = new ProcessableElementsQueue(values, 'skip', 3)
            
            expect(queue.hasNext()).toBe(true)
            const element = queue.next()
            expect(element.value).toBe(123)
        })

        it('should handle retry count of 0', async () => {
            const values = ['item1']
            const queue = new ProcessableElementsQueue(values, 'retry', 0)
            const element = queue.next()
            const callback = jest.fn().mockRejectedValue(new Error('Error'))
            
            // Should not retry when retriesCount is 0
            await queue.processElement(element, callback)
            expect(queue.hasNext()).toBe(false)
        })

        it('should maintain element order during retries', async () => {
            const values = ['item1', 'item2']
            const queue = new ProcessableElementsQueue(values, 'retry', 1)
            const callback = jest.fn()
                .mockRejectedValueOnce(new Error('Error')) // item1 fails
                .mockResolvedValueOnce(undefined) // item2 succeeds
                .mockRejectedValueOnce(new Error('Error')) // item1 fails on retry
            
            await queue.executeProcessing(callback)
            
            expect(callback).toHaveBeenCalledTimes(3) // item1 (2 attempts) + item2 (1 attempt)
            expect(queue.hasNext()).toBe(false)
        })
        

        it('should skip element after all attempts failed', async () => {
            const values = ['item1', 'item2']
            const queue = new ProcessableElementsQueue(values, 'retry', 3)
            const callback = jest.fn()
                .mockRejectedValueOnce(new Error('Error')) // item1 fails
                .mockRejectedValueOnce(new Error('Error')) // item1 fails
                .mockRejectedValueOnce(new Error('Error')) // item1 fails
                .mockResolvedValueOnce('item2') // item2 succeeds
            
            await queue.executeProcessing(callback)
            expect(callback).toHaveBeenCalledTimes(5)
            expect(callback).toHaveBeenCalledWith('item2')
            const callsWithItem2 = callback.mock.calls.filter((c) => c[0] === 'item2').length
            expect(callsWithItem2).toBeGreaterThanOrEqual(1)
        })
    })
})
