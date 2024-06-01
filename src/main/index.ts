#!/usr/bin/env node

import yargs from 'yargs/yargs'
import 'dotenv/config'
import path from 'path'


yargs(process.argv.slice(2))
    .options({
        host: {
            type: 'string',
            default: process.env.GITLAB_HOST,
            demandOption: true,
            desc: 'дефолт берется из переменной окружения GITLAB_HOST',
            hidden: true,
        },
        token: {
            type: 'string',
            default: process.env.GITLAB_TOKEN,
            defaultDescription: !process.env.GITLAB_TOKEN ? 'undefined' : excapeToken(process.env.GITLAB_TOKEN),
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
            choice: ['retry', 'abort', 'skip'],
            default: 'retry',
            hidden: true
        },
        'retries': {
            desc: 'Количество повторных попыток при обработке исключений. Если все попытки исчерпаны, но ошибка не починилась, то применяется вариант \'--on-error=skip\'',
            type: 'number',
            default: 3,
            hidden: true
        }
    })
    .commandDir(path.join('infrastructure', 'cli'))
    .scriptName('gitlab-tools')
    .alias('help', ['h'])
    .showHidden('show-hidden', 'Show hidden options')
    .demandCommand(1)
    .strict()
    .wrap(160)
    .parseAsync()
    .then();

function excapeToken(token: string, left = 3, right = 2): string {
    if (token.length < left + right)
        return token[0] + new Array(token.length).join('*');
    const regex = new RegExp(`^(.{${left},${left}}).*(.{${right},${right}})$`, 'ig');
    return token.replace(regex, `$1${new Array(token.length - left - right + 1).join('*')}$2`);
}