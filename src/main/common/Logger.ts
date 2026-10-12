import winston from 'winston'
import { buildLogFilePath } from './LogFiles'
import { getRuntimeConfig } from './ProfileConfig'

function logFilePath(): string {
    const { logFilename } = getRuntimeConfig()
    const name =
        logFilename ||
        (Math.random() * 100).toString(36).replace('.', '')
    return buildLogFilePath(name)
}

export function createLogger(loggerName: string): winston.Logger {
    const logger = winston.createLogger({
        format: winston.format.simple(),
        defaultMeta: {
            logger: loggerName,
        },
        transports: [
            new winston.transports.File({
                format: winston.format.combine(
                    winston.format.json(),
                    winston.format.timestamp(),
                ),
                filename: logFilePath(),
            }),
        ],
    })

    if (getRuntimeConfig().debug)
        logger.add(new winston.transports.Console({
            format: winston.format.simple(),
        }))

    return logger
}

let httpClientLoggerInstance: winston.Logger | undefined

export function getHttpClientLogger(): winston.Logger {
    if (!httpClientLoggerInstance)
        httpClientLoggerInstance = createLogger('GitlabHttp')
    return httpClientLoggerInstance
}

/** Пересоздать HTTP-логгер после смены LOG_FILENAME / DEBUG в runtime. */
export function refreshHttpClientLogger(): void {
    httpClientLoggerInstance = undefined
}

/** @deprecated используйте getHttpClientLogger(); оставлено для совместимости импортов */
export const httpClientLogger = new Proxy({} as winston.Logger, {
    get(_target, prop, receiver) {
        return Reflect.get(getHttpClientLogger(), prop, receiver)
    },
})

export default (parent: Function) => createLogger(parent.name)
