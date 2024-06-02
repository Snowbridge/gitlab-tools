import Logger from './Logger'

type QueueElement<T = any> = {
    value: T
    attempt: number
    name: string // human-readable value name to refer to in log messages
}

type ProcessorCallback<T = any> = (value: T) => Promise<void>

export class ProcessableElementsQueue<T = any> {
    private processbaleElements: QueueElement<T>[]
    private onError: 'abort' | 'retry' | 'skip'
    private retriesCount: number
    private logger = Logger(this.constructor)

    /**
     * 
     * @param values - array of processed vlues
     * @param onError - what to do when an esception id caught during the pricessing
     * @param retriesCount - the number of retries to take if onError = retry
     * @param valueNameingCallback - a function that returns the human-readable representation of the value for the logs
     */
    constructor(values: T[], onError: 'abort' | 'retry' | 'skip', retriesCount: number, valueNameingCallback?: (value: T) => string) {
        this.processbaleElements = values.map(it => {
            return {
                value: it,
                attempt: 0,
                name: `${valueNameingCallback ? valueNameingCallback(it) : (it as { name: string }).name || JSON.stringify(it, undefined, '').slice(0, 16)}`
            } as QueueElement<T>
        })
        this.onError = onError
        this.retriesCount = retriesCount || 3
    }

    hasNext() {
        return this.processbaleElements.length > 0
    }

    next(): QueueElement<T> {
        return this.processbaleElements.shift()!!
    }

    // для случаев, когда в колбэке могут возникать исключения, которые нельзя ретраить ни при каких значениях входящей настройки ретрая
    //  в этом случае вся retriable-обработка происходит в колбэке, а non-retriable где-то снаружи колбэка
    async processElement(element: QueueElement<T>, callback: ProcessorCallback<T>) {

        try {
            await callback(element.value)
            this.logger.info(`Attempt # ${element.attempt} on ${element.name} successfull`)
        } catch (error: any) {
            this.logger.info(`Attempt # ${element.attempt} on ${element.name} failed due to an exception ${error.error ? error.error.message : error.message || JSON.stringify(error, undefined, undefined)}`)
            if (this.onError == 'skip') {
                this.logger.info(`${element.name} is skipped`)
                return
            }

            if (this.onError == 'abort') {
                this.logger.info(`aborting execution`)
                throw error
            }

            if (element.attempt < this.retriesCount) {
                this.logger.info(`There are ${this.retriesCount - element.attempt} attempts left, pushing ${element.name} back to the queue`)
                element.attempt += 1
                this.processbaleElements.push(element)
            } else {
                this.logger.info(`The ${element.name} is unprocessable, all ${element.attempt} attempt failed, the element is skipped`)
            }
        }
    }

    // для общих случаев, когда в уолбэке могут быть только retriable-исключения
    executeProcessing(callback: ProcessorCallback<T>) {
        while (this.hasNext())
            this.processElement(this.next(), callback)
    }
}