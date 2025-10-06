import * as Path from 'node:path'
import os from 'node:os'
import winston from "winston"

export default (parent: Function) => {
    const logger = winston.createLogger({
        format: winston.format.simple(),
        defaultMeta: {
            logger: parent.name
        },
        transports: [
            new winston.transports.File({
                format: winston.format.combine(
                    winston.format.json(),
                    winston.format.timestamp()
                ),
                filename: Path.join(
                    Path.resolve(os.tmpdir()),
                    `${process.env.LOG_FILENAME || (Math.random() * 100).toString(36).replace('.', '')}.json`
                )
            }),
        ]
    })

    if (!!process.env.DEBUG)
        logger.add(new winston.transports.Console({
            format: winston.format.simple(),
        }))

    return logger
}