#!/usr/bin/env node

import yargs from 'yargs/yargs'
import path from 'path'
import { refreshHttpClientLogger } from './common/Logger'
import {
    defaultLogFilename,
    escapeTokenForDisplay,
    getRuntimeConfig,
    loadActiveProfileIntoRuntime,
    patchRuntimeConfig,
} from './common/ProfileConfig'

loadActiveProfileIntoRuntime()

const initial = getRuntimeConfig()

yargs(process.argv.slice(2))
    .options({
        host: {
            type: 'string',
            default: initial.host,
            desc: 'хост GitLab; по умолчанию HOST из активного профиля',
            hidden: true,
        },
        token: {
            type: 'string',
            default: initial.token,
            defaultDescription: !initial.token ? 'undefined' : escapeTokenForDisplay(initial.token),
            desc: 'токен GitLab; по умолчанию TOKEN из активного профиля',
            hidden: true,
        },
        port: {
            type: 'number',
            default: initial.port,
            desc: 'TCP-порт, на котором раздается Gitlab API',
            hidden: true,
        },
        'on-error': {
            desc: 'Что делать при возникновении исключений, применяется к ошибкам работы с REST и некоторым другим.',
            choices: ['retry', 'abort', 'skip'],
            default: initial.onError,
            hidden: true
        },
        'retries': {
            desc: 'Количество повторных попыток при обработке исключений. Если все попытки исчерпаны, но ошибка не починилась, то применяется вариант \'--on-error=skip\'',
            type: 'number',
            default: initial.retries,
            hidden: true
        },
        log: {
            desc: 'Имя файла, в который складываются логи',
            type: 'string',
            default: initial.logFilename || defaultLogFilename(),
            hidden: true,
            coerce: (argv) => {
                patchRuntimeConfig({ logFilename: argv })
                refreshLoggers()
                return argv
            }
        },
        debug: {
            desc: 'Если передан флаг, то логи будут сыпаться в консоль',
            hidden: true,
            default: undefined,
            type: 'boolean'
        }
    })
    .commandDir(path.join('infrastructure', 'cli'))
    .scriptName('gitlab-tools')
    .alias('help', ['h'])
    .showHidden('show-hidden', 'Show hidden options')
    .demandCommand(1)
    .check((argv) => {
        patchRuntimeConfig({
            host: argv.host as string | undefined,
            token: argv.token as string | undefined,
            port: argv.port as number,
            onError: argv.onError as 'retry' | 'abort' | 'skip',
            retries: argv.retries as number,
            debug: !!argv.debug || getRuntimeConfig().debug,
        })
        if (argv.debug)
            refreshLoggers()
        const top = argv._[0]
        if (top === 'config' || top === 'log')
            return true
        if (top === 'workspace') {
            const sub = argv._[1] as string | undefined
            if (!sub) return true
            if (sub === 'status' || sub === 'switch' || sub === 'remote') return true
        }
        if (!argv.host || !argv.token)
            throw new Error(
                'Задайте HOST и TOKEN в активном профиле (gitlab-tools config use / config edit) или передайте --host и --token',
            )
        return true
    })
    .strict()
    .wrap(160)
    .parseAsync()
    .then();

function refreshLoggers(): void {
    refreshHttpClientLogger()
}
