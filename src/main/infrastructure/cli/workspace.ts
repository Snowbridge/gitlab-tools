import yargs from 'yargs'

export const command = 'workspace'

export const aliases = ['ws', 'w'];

export const describe = 'Манипуляции с локальными рабочими копиями'

const DETAILED_DESCRIPTION = [
    'Группа команд для манипуляций с локальными рабочими копиями git.',
    'Общие опции --dir, --repos, --interactive, --all наследуются всеми субкомандами.',
    'Рабочие копии передаются через --repos/-r (пути относительно --dir); если копий нет —',
    'требуется --all (взять все из --dir) или --interactive (выбрать галками в консоли).',
].join('\n')

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace <command>\n\n${DETAILED_DESCRIPTION}`)
        .options({
            dir: {
                type: 'string',
                default: '.',
                alias: ['d'],
                desc: 'Путь/имя воркспэйса, дефолт CWD',
            },
            interactive: {
                alias: 'i',
                type: 'boolean',
                desc: 'Выбор рабочих копий из чек-листа в консоли. Конфликтует с --all',
            },
            all: {
                alias: 'a',
                type: 'boolean',
                desc: 'Обработать все подходящие рабочие копии из --dir без указания аргументов. Конфликтует с --interactive',
            },
            repos: {
                type: 'string',
                array: true,
                alias: ['r'],
                default: [] as string[],
                desc: 'Пути к рабочим копиям относительно --dir (если не указаны — требуется --all или --interactive)',
            },
        })
        .check((argv) => {
            const any = argv as any
            if (any.interactive && any.all)
                throw new Error('Опции --interactive и --all не могут использоваться вместе')
            const repos = (any.repos as string[]) ?? []
            if (repos.length > 0 && (any.all || any.interactive))
                throw new Error('Нельзя указывать рабочие копии вместе с --all или --interactive')
            return true
        })
        .commandDir('workspace')
        .demandCommand(1, 'Укажите субкоманду workspace')
        .epilog(DETAILED_DESCRIPTION)
        .showHelpOnFail(false)
}

export const handler = (): void => {}
