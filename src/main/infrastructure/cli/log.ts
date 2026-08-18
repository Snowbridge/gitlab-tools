import fs from 'fs'
import yargs from 'yargs'
import {
    getLogDirectory,
    getMostRecentLogFileName,
    listLogFileNames,
    readLogLines,
    resolveLogFilePath,
} from '../../common/LogFiles'

export const command = 'log'

export const describe = 'Показать JSON-логи из $TMP'

const DETAILED_DESCRIPTION = 'Чтение JSON-логов из $TMP, созданных утилитой gitlab-tools.'

interface LogArgv {
    list?: boolean
    source?: string
    all?: boolean
    lines?: number
}

export const builder = (y: yargs.Argv) =>
    y.usage(`$0 log\n\n${DETAILED_DESCRIPTION}`)
        .options({
            lines: {
                alias: 'n',
                type: 'number',
                requiresArg: true,
                desc: 'Количество последних строк для вывода (по умолчанию 20)',
            },
            all: {
                type: 'boolean',
                desc: 'Вывести весь лог',
            },
            list: {
                type: 'boolean',
                desc: 'Список имён файлов логов',
            },
            source: {
                type: 'string',
                requiresArg: true,
                desc: 'Имя файла лога для чтения',
            },
        })
        .check((argv) => {
            if (argv.all && argv.lines !== undefined)
                throw new Error('Опции --all и --lines не могут использоваться вместе')
            if (argv.list && (argv.source || argv.all || argv.lines !== undefined))
                throw new Error('Опция --list не может использоваться вместе с --source, --lines или --all')
            if (argv.lines !== undefined && (!Number.isInteger(argv.lines) || argv.lines <= 0))
                throw new Error('Опция --lines должна быть целым числом больше 0')
            return true
        })
        .example('$0 log', 'Последние 20 строк из самого нового лога')
        .example('$0 log --lines 100', 'Последние 100 строк из самого нового лога')
        .example('$0 log --all', 'Весь самый новый лог')
        .example('$0 log --list', 'Список файлов логов')
        .example(
            '$0 log --source gitlab-tools-2026-08-18T09-14-00.123Z.log.json --lines 100',
            'Последние 100 строк из указанного лога',
        )

export const handler = (argv: LogArgv): void => {
    if (argv.list) {
        for (const name of listLogFileNames())
            console.log(name)
        return
    }

    const fileName = argv.source ?? getMostRecentLogFileName()
    if (!fileName)
        throw new Error(`Логи не найдены в ${getLogDirectory()}`)

    const filePath = resolveLogFilePath(fileName)
    if (!fs.existsSync(filePath))
        throw new Error(`Файл лога не найден: ${filePath}`)

    const lineCount = argv.all ? undefined : (argv.lines ?? 20)
    for (const line of readLogLines(filePath, lineCount))
        console.log(line)
}
