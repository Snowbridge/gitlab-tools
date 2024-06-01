type QueueElement<T = any> = {
    value: T
    attempt: number
}

type ProcessorCallback<T = any> =  (value: T) => Promise<void>

export class ProcessableElementsQueue<T = any> {
    private queue: QueueElement<T>[]
    private onError: 'abort' | 'retry' | 'skip'
    private retriesCount: number

    constructor(values: T[], onError: 'abort' | 'retry' | 'skip', retriesCount: number) {
        this.queue = values.map(it => {
            return { value: it, attempt: 0 } as QueueElement<T>
        })
        this.onError = onError
        this.retriesCount = retriesCount
    }

    hasNext() {
        return this.queue.length > 0
    }

    next(): QueueElement<T> {
        return this.queue.shift()!!
    }

    // для случаев, когда в колбэке могут возникать исключения, которые нельзя ретраить ни при каких значениях входящей настройки ретрая
    //  в этом случае вся retriable-обработка происходит в колбэке, а non-retriable где-то снаружи колбэка
    async processElement(element: QueueElement<T>, callback: ProcessorCallback<T>) {
        try {
            await callback(element.value)
        } catch (error) {
            if (this.onError == 'abort')
                throw error
            if (this.onError == 'retry' && element.attempt < this.retriesCount) {
                element.attempt += 1
                this.queue.push(element)
            } else {                
                console.log(`${(element.value as {[key:string]:any})['name']||'<unknown>'} has been skipped due to processing exception: ${error}`)
            }
        }
    }

    // для общих случаев, когда в уолбэке могут быть только retriable-исключения
    executeProcessing(callback: ProcessorCallback<T>) {
        while (this.hasNext())
            this.processElement(this.next(), callback)
    }
}