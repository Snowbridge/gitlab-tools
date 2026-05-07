#!/usr/bin/env node

import dotenv from 'dotenv'
import fs from 'fs'
import yargs from 'yargs/yargs'
import path from 'path'
import { profileFilePath, readActiveProfileName } from './services/ConfigProfileService'

loadConfig()

yargs(process.argv.slice(2))
    .options({
        host: {
            type: 'string',
            default: process.env.GITLAB_HOST,
            desc: 'дефолт берется из переменной окружения GITLAB_HOST',
            hidden: true,
        },
        token: {
            type: 'string',
            default: process.env.GITLAB_TOKEN,
            defaultDescription: !process.env.GITLAB_TOKEN ? 'undefined' : escapeToken(process.env.GITLAB_TOKEN),
            desc: 'дефолт берется из переменной окружения GITLAB_TOKEN',
            hidden: true,
        },
        port: {
            type: 'number',
            default: 443,
            desc: 'TCP-порт, на котором раздается Gitlab API',
            hidden: true,
        },
        'on-error': {
            desc: 'Что делать при возникновении исключений, применяется к ошибкам работы с REST и некоторым другим.',
            choices: ['retry', 'abort', 'skip'],
            default: 'retry',
            hidden: true
        },
        'retries': {
            desc: 'Количество повторных попыток при обработке исключений. Если все попытки исчерпаны, но ошибка не починилась, то применяется вариант \'--on-error=skip\'',
            type: 'number',
            default: 3,
            hidden: true
        },
        log: {
            desc: 'Имя файла, в который складываются логи',
            type: 'string',
            default: `gitlab-tools-${new Date().toISOString().replaceAll(':', '-')}.log`,
            hidden: true,
            coerce: (argv) => {
                process.env.LOG_FILENAME = argv
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
        if (!!argv.debug)
            process.env.DEBUG = 'true'
        const top = argv._[0]
        if (top === 'config')
            return true
        if (!argv.host || !argv.token)
            throw new Error('Задайте GITLAB_HOST и GITLAB_TOKEN (или опции --host и --token)')
        return true
    })
    .strict()
    .wrap(160)
    .parseAsync()
    .then();

function loadConfig() {
    const profileName = readActiveProfileName()
    if (profileName) {
        const confPath = profileFilePath(profileName)
        if (fs.existsSync(confPath))
            dotenv.config({ path: confPath, override: true })
    }
    dotenv.config({ override: true })
}

function escapeToken(token: string, left = 3, right = 2): string {
    if (token.length < left + right)
        return token[0] + new Array(token.length).join('*');
    const regex = new RegExp(`^(.{${left},${left}}).*(.{${right},${right}})$`, 'ig');
    return token.replace(regex, `$1${new Array(token.length - left - right + 1).join('*')}$2`);
}