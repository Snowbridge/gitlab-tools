import ora from 'ora'
import Logger from './Logger'

type QueueElement<T = any> = {
    value: T
    attempt: number
    name: string // human-readable value name to refer to in log messages
}

type ProcessorCallback<T = any> = (value: T) => Promise<void>

export class ProcessableElementsQueue<T = any> {
    private processableElements: QueueElement<T>[]
    private onError: 'abort' | 'retry' | 'skip'
    private retriesCount: number
    private logger = Logger(this.constructor)

    /**
     * 
     * @param values - array of processed values
     * @param onError - what to do when an exception id caught during the processing
     * @param retriesCount - the number of retries to take if onError = retry
     * @param valueNameingCallback - a function that returns the human-readable representation of the value for the logs
     */
    constructor(values: T[], onError: 'abort' | 'retry' | 'skip', retriesCount: number, valueNamingCallback?: (value: T) => string) {
        const defaultNamingCallback = (it: any) => {
            if (!it) return 'unknown'
            if (it.name) return it.name
            return JSON.stringify(it, undefined, '').slice(0, 16)
        }
        this.processableElements = values.map(it => {
            return {
                value: it,
                attempt: 1,
                name: `${valueNamingCallback ? valueNamingCallback(it) : defaultNamingCallback(it)}`
            } as QueueElement<T>
        })
        this.onError = onError
        this.retriesCount = retriesCount == undefined ? 3 : retriesCount
        if(onError == 'skip')
            this.retriesCount = 0
    }

    hasNext() {
        return this.processableElements.length > 0
    }

    next(): QueueElement<T> {
        return this.processableElements.shift()!!
    }

    // для случаев, когда в колбэке могут возникать исключения, которые нельзя ретраить ни при каких значениях входящей настройки ретрая
    //  в этом случае вся retriable-обработка происходит в колбэке, а non-retriable где-то снаружи колбэка
    async processElement(element: QueueElement<T>, callback: ProcessorCallback<T>) {

        const spinner = ora(`${element.name}`).start()
        try {
            await callback(element.value)
            this.logger.info(`Attempt # ${element.attempt} on ${element.name} successful`)
            spinner.succeed()
        } catch (error: any) {
            const errMsg = error?.error?.message ?? error?.message ?? String(error)
            this.logger.info(errMsg)
            if (this.onError == 'retry')
                if (this.retriesCount >= element.attempt) {
                    spinner.fail(`${element.name} failed attempt ${element.attempt} of ${this.retriesCount}`)
                    element.attempt = (element.attempt||1) + 1
                    this.processableElements.push(element)
                    this.logger.info({
                        message: `Failed attempt # ${element.attempt}, pushing ${element.name} back to queue`,
                        error: error
                    })
                } else {
                    spinner.fail(`${element.name} is unprocessable, skipped`)
                    this.logger.warn({
                        message: `The ${element.name} is unprocessable, all ${element.attempt} attempt failed, the element is skipped`,
                        error: error
                    })
                }
            else if (this.onError == 'abort') {
                spinner.fail(`${element.name} is unprocessable, aborting`)
                this.logger.error({
                    message: `aborting execution`,
                    error: error
                })
                throw error
            } else {
                spinner.fail(`${element.name} is unprocessable, skipped`)
                this.logger.warn({
                    message: `The ${element.name} is unprocessable, skipped`,
                    error: error
                })
            }
        }
    }

    // для общих случаев, когда в колбэке могут быть только retriable-исключения
    async executeProcessing(callback: ProcessorCallback<T>) {
        while (this.hasNext())
            await this.processElement(this.next(), callback)
    }
}