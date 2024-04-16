#!/usr/bin/env node

import yargs from 'yargs/yargs';
import 'dotenv/config';
import path from 'path';


yargs(process.argv.slice(2))
    .options({
        host: {
            type: 'string',
            default: process.env.GITLAB_HOST,
            demandOption: true,
            desc: 'дефолт берется из переменной окружения GITLAB_HOST',
        },
        token: {
            type: 'string',
            default: process.env.GITLAB_TOKEN,
            defaultDescription: !process.env.GITLAB_TOKEN ? 'undefined' : excapeToken(process.env.GITLAB_TOKEN),
            desc: 'дефолт берется из переменной окружения GITLAB_TOKEN',
        },
        port: {
            type: 'number',
            default: 443,
            desc: 'TCP-порт, на котором раздается Gitlab API',
        }

        /*,
        'log-level': {
            default: 'INFO',
            choices: ['INFO','DEBUG'],
            desc: 'Уровень логирования. При `LOG` логируются только важные события и лог складывается в /tmp. При уровне `DEBUG` логируется гораздо больше событий и лог складывается в каталог, из которого вызван скрипт'
        }*/
    })
    .commandDir(path.join('infrastructure', 'cli'))
    .scriptName('gitlab-tools')
    .hide('host')
    .hide('token')
    .hide('port')
    .alias('help',['h'])
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