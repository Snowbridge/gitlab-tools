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
        const defaultNamingCallback = (it:any)=>{
            if(!it) return 'unknown'
            if(it.name) return it.name
            return JSON.stringify(it, undefined, '').slice(0, 16)
        }
        this.processableElements = values.map(it => {
            return {
                value: it,
                attempt: 0,
                name: `${valueNamingCallback ? valueNamingCallback(it) : defaultNamingCallback(it)}`
            } as QueueElement<T>
        })
        this.onError = onError
        this.retriesCount = retriesCount == undefined ? 3 : retriesCount
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

        try {
            element.attempt += 1
            await callback(element.value)
            this.logger.info(`Attempt # ${element.attempt} on ${element.name} successful`)
        } catch (error: any) {
            if(this.onError == 'retry')
                if(this.retriesCount >= element.attempt){
                    this.processableElements.push(element)
                    this.logger.info(`Failed attempt # ${element.attempt}, pushing ${element.name} back to queue`)
                }else{
                    this.logger.warn(`The ${element.name} is unprocessable, all ${element.attempt} attempt failed, the element is skipped`)
                }
            else if(this.onError == 'abort'){
                this.logger.error(`aborting execution`)
                throw error
            }else{
                this.logger.warn(`The ${element.name} is unprocessable, skipped`)
            }
        }
    }

    // для общих случаев, когда в колбэке могут быть только retriable-исключения
    async executeProcessing(callback: ProcessorCallback<T>) {
        while (this.hasNext())
            await this.processElement(this.next(), callback)
    }
}