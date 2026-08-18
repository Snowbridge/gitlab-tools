import winston from 'winston'
import { buildLogFilePath } from './LogFiles'

function logFilePath(): string {
    return buildLogFilePath(
        process.env.LOG_FILENAME || (Math.random() * 100).toString(36).replace('.', ''),
    )
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

    if (!!process.env.DEBUG)
        logger.add(new winston.transports.Console({
            format: winston.format.simple(),
        }))

    return logger
}

export const httpClientLogger = createLogger('GitlabHttp')

export default (parent: Function) => createLogger(parent.name)
