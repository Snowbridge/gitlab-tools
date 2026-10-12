import yargs from 'yargs'

export const command = 'remote <command>'

export const describe = 'Управление git remote в рабочих копиях'

const DETAILED_DESCRIPTION = [
    'Подкоманды — обёртки над `git remote …` для каждой выбранной рабочей копии.',
    'Выбор копий — через resolveWorkspaceCopies: --repos/-r (наследуется от workspace), либо --all, либо --interactive.',
    'Короткие алиасы git, конфликтующие с workspace (-a для --all, -d для --dir), не экспортируются; используйте длинные формы (--auto, --delete и т.д.).',
].join('\n')

export const builder = (y: yargs.Argv) => {
    return y
        .usage(`$0 workspace remote <command>\n\n${DETAILED_DESCRIPTION}`)
        .commandDir('remote')
        .demandCommand(1, 'Укажите подкоманду remote')
        .epilog(DETAILED_DESCRIPTION)
        .showHelpOnFail(false)
}

export const handler = (): void => {}
