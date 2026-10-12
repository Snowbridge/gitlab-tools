# Gitlab Tools

Утилита для пакетной обработки репозиториев.

Основные фичи:

1. Отчеты по репозиториям с гибкими отборами по содержимому
2. Пакетное клонирование по списку или по результатам отборов
3. Манипулирование топиками
4. Пакетные git-операции над локальными рабочими копиями (`workspace`)
5. Публикация локальных репозиториев в GitLab (`workspace publish`)

[[_TOC_]]

## CLI

```bash
#Склонировать в папку ./repos все проекты, которые (одновременно):
# -q archived=false - не заархивированы 
# -q search=dictionary - есть слово "dictionary" в названии, описании, пути
# -q topic=team:Alpha - есть тэг "team:Alpha"
# --query-path group/subgroup/ - в урле есть подстрока "foo/bar"
$ gitlab-tools clone -d ./repos -q archived=false -q search=dictionary -q topic=team:Alpha --query-path foo/bar
```

## Install

### Глобальная установка

Клонируйте репозиторий и из его корня выполните:

```bash
git clone git@github.com:Snowbridge/gitlab-tools.git
cd gitlab-tools
npm run install-globally   # на Linux/macOS при необходимости sudo; на Windows — без sudo
```

Утилита доступна как `gitlab-tools` и короткий алиас `gtlz`:

```bash
gitlab-tools --help
```

Далее [настройте профиль](#настройка-профиля).

### Настройка профиля

Параметры подключения к GitLab хранятся в профилях в каталоге `~/.config/gitlab-tools/`:

- файл `<имя>.conf` — хост и токен доступа (формат dotenv, по одному параметру на строку);
- файл `profile` — имя активного профиля (одна строка).

Типичный сценарий для нового пользователя:

```bash
gitlab-tools config create mygitlab
gitlab-tools config edit mygitlab    # указать хост и токен в открывшемся файле
gitlab-tools config use mygitlab
gitlab-tools config test
```

Дополнительно:

- `gitlab-tools config list` — список профилей;
- `gitlab-tools config` без субкоманды — активный профиль и его содержимое (токен маскируется; см. `--unmasked` в справке);
- `gitlab-tools config remove <имя>` — удалить профиль.

Для большинства команд нужен **активный профиль** с заполненным хостом и токеном. Без обращения к GitLab API работают: `config`, `log`, а также `workspace status`, `workspace switch` и `workspace remote` (и их субкоманды).

## Команды

Краткий обзор команд верхнего уровня. Подробные опции: `gitlab-tools <команда> --help`; для скрытых опций отбора репозиториев — `--show-hidden`.

### `clone`

Склонировать репозитории по отборам GitLab (`-q`, `--qp`, `--qn` и др.).

### `report` (`rep`, `r`)

Отчёт по репозиториям GitLab: те же опции отбора, что у `clone`.

### `topics` (`top`, `t`)

Изменение топиков у отобранных репозиториев:

- `add` (или `+`) — добавить топики к списку в аргументах;
- `remove` (или `rm`) — снять указанные топики;
- `clear` (или `^`) — очистить все топики.

### `workspace` (`ws`, `w`)

Манипуляции с локальными рабочими копиями git. Субкоманды — в [разделе ниже](#workspace).

### `config`

Управление профилями подключения к GitLab:

- `create <имя>` — создать файл профиля;
- `list` — список профилей;
- `use <имя>` — сделать профиль активным;
- `edit [имя]` — редактировать файл в `$EDITOR` (или `nano`);
- `remove <имя>` — удалить профиль;
- `test [имя]` — проверить доступность GitLab API.

### `log`

Показать JSON-логи из системного каталога временных файлов (`$TMP`), которые пишет утилита при работе.

## workspace

Общие опции для всех субкоманд (задаются на `workspace` перед именем субкоманды):

| Опция | Описание |
| ------- | ---------- |
| `--dir` / `-d` | Корень воркспейса (по умолчанию текущий каталог) |
| `--repos` / `-r` | Пути к копиям относительно `--dir` (можно несколько) |
| `--all` / `-a` | Все подходящие копии в `--dir` |
| `--interactive` / `-i` | Выбор копий в консоли |

`--all` и `--interactive` взаимоисключающи; с `--repos` их сочетать нельзя. Если `--repos` не задан, нужен `--all` или `--interactive`.

### Субкоманды

| Субкоманда | Назначение |
| ------------ | ------------ |
| `fetch [remote] [refspec..]` | Выполнить `git fetch` в выбранных копиях |
| `pull [remote] [branch..]` | Выполнить `git pull` |
| `merge <from> [to]` | Слить ветку в текущие рабочие копии |
| `switch [branch]` | Переключить рабочие копии на ветку |
| `status` | Показать `git status` рабочих копий |
| `publish` (`pub`) | Опубликовать локальные репозитории в GitLab |
| `remote <command>` | Управление `git remote` в рабочих копиях |

### `workspace remote`

Эта субкоманда имеет свои субкоманды:

| Субкоманда | Назначение |
| ------------ | ------------ |
| `add <name> <url>` | Добавить remote |
| `list` | Список remotes |
| `remove <name>` | Удалить remote |
| `rename <old> <new>` | Переименовать remote |
| `get-url <name>` | Получить URL remote |
| `set-head <name> [branch]` | Установить `refs/remotes/<name>/HEAD` |
| `set-branches <name> [branch..]` | Ограничить список отслеживаемых веток remote |
| `prune <name>` | Prune устаревших remote-tracking веток |

## Usage example

Если вот такой скрипт сложить в файл, например, `afinance.sh`, то при первом запуске он вытащит весь А.Финанс и разложит по папкам, а при всех последдующих будет клонить недостающие, а существующие будет фетчить:

```bash
#!/bin/bash

echo "application codebase"
gitlab-tools clone --dir ./app --qp ^farzoom/afinance/\(?\!fz-\).* --trim 2
gitlab-tools clone --dir ./app/common --qp ^farzoom/common/\(?\!fz-\).* --trim 2
gitlab-tools clone --dir ./app/poas-system --qp farzoom/afinance-poas-system --trim 2
gitlab-tools clone --dir ./app/rate --qp farzoom/afinance-rate --trim 2
gitlab-tools clone --dir ./app/spr --qp farzoom/afinance-spr --trim 2
gitlab-tools clone --dir ./app/tmpl-system --qp farzoom/afinance-tmpl-system --trim 2

echo "libraries"
gitlab-tools clone --dir ./libs --qp ^farzoom/afinance/fz-.* ^farzoom/common/fz-.* --trim 2

echo "other"
gitlab-tools clone --dir ./ --qp ^farzoom/\(autotests\|configs\|devops\|documentation\|templates\|tools\|data-models\) --trim 1
```

С последним пунктом внимательнее, т.к. это не именно личные, а все, у кого вы `owner`. Хотя беды и не будет, конечно.

## Рэгэкспы в командной строке

Некоторые опции и команды, наример `--query-path` позволяют оперировать регэкспами. Однако некоторые символы, используемые в регэкспах, являются управляющими для shell, поэтому при использовании регэкспов необходимо эти управляющие символы экранировать.

| Управляющий символ | Замена |
|--------------------|--------|
| `!`                | `\!`    |
| `(`                | `\(`    |
| `)`                | `\)`    |
| `;`                | `\;`    |
| `$`                | `\$`    |

Например, вместо `--qp adapter$` нужно передавать `--qp adapter\$`, вместо `--qp ^farzoom/common/(?!fz-).*` — `--qp ^farzoom/common/\(?\!fz-\).*`
