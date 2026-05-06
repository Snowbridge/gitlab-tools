# Gitlab Tools

Утилита для пакетной обработки репозиториев.

Основные фичи:

1. Отчеты по репозиториям с гибкими отборами по содержимому
2. Пакетное клонирование по списку или по результатам отборов
3. Манипулирование топиками

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

Существует несколько вариантов установки:

1. [Локальная](#локальная-установка) - когда мы компилируем скрипты в каталоге репы и запускаем всегда из этого каталога
2. [Глобальная](#глобальная-установка) - когда скрипт устанавливается, как глобальный npm-модуль и доступен по имени `gitab-tools` из всех шеллов и из любого места системы
3. [Докер образ](#сборка-докер-образа) - для тех, кому не хочется ставить локально node.js

### Локальная установка

Это самы простой и надежный вариант с единственным нюансом - скрипт будет доступен только из каталога, в который он установлен.

```bash
$ git pull git@github.com:Snowbridge/gitlab-tools.git
$ cd ./gitlab-tools # скрипт будет жить в этом каталоге
$ mkdir out # команда report будет сюда складывать json-отчеты
$ npm install
$ npm run rebuild
```

Всё готово к работе, читай справку:

```bash
$ node . --help
```

Осталось [настроить окружение](#настройка-окружения)

### Глобальная установка

Можно установить скрипт глобально, тогда он будет отзываться во всех шеллах по имени `$ gitlab-tools`, для этого:

```bash
$ sudo npm run install-globally # на винде нужно без sudo
```

Скрипт готов к работе, вызывается по имени:

```bash
$ gitlab-tools --help
```

Осталось [настроить окружение](#настройка-окружения)

### Настройка окружения

Далее нужно добавить переменные окружения `GITLAB_HOST` и `GITLAB_TOKEN`.

На `linux` или в `git bash for windows` просто добавляем в `~/.bashrc` или `~/.zshrc` строки:

```shell
export GITLAB_HOST="git.a-fin.tech"
export GITLAB_TOKEN="TC79o8Y6wqr4DAubzrYP"
```

и перезагрузить *shrc командой `$ . ~/.bashrc` (`$ . ~/.zshrc`)

На винде - см сюда: https://phoenixnap.com/kb/windows-set-environment-variable#ftoc-heading-4

### Сборка докер образа

Процесс состоит из фактически одного этапа - сборка докер-образа:

```bash
#  клоним репу, как обычно
$ git pull git@github.com:Snowbridge/gitlab-tools.git
$ cd ./gitlab-tools 
# собираем образ
#   аргументы TOKEN и HOST не обязательны, но, если их не указать, то потом при запуске контейнера придется все время из в командной строке передавать
#   имя образа включает `-afin` как раз, чтобы намекнуть, что это узкозаточенный образ
$ docker build -t gitlab-tools-afin --build-arg TOKEN=${your-gitlab-token} --build-arg HOST=git.a-fin.tech .
```

Дальше просто используем через `docker run`:

```bash
# Вывести на консоль все репы, у которых в имени есть `bg-pa`
$ docker run --rm gitlab-tools-afin gitlab-tools report -q search=bg-pa
```

## Usage example

Если вот такой скрипт сложить в файл, например, `afinance.sh`, то при первом запуске он вытащит весь А.Финанс и разложит по папкам, а при всех последдующих будет клонить недостающие, а существующие будет фетчить:

```bash
#!/bin/bash

echo "application codebase"
gitlab-tools clone --dir ./app --qp ^farzoom/afinance/\(?\!fz-\).* --trim 2  --existing pull
gitlab-tools clone --dir ./app/common --qp ^farzoom/common/\(?\!fz-\).* --trim 2  --existing pull
gitlab-tools clone --dir ./app/poas-system --qp farzoom/afinance-poas-system --trim 2  --existing pull
gitlab-tools clone --dir ./app/rate --qp farzoom/afinance-rate --trim 2  --existing pull
gitlab-tools clone --dir ./app/spr --qp farzoom/afinance-spr --trim 2  --existing pull
gitlab-tools clone --dir ./app/tmpl-system --qp farzoom/afinance-tmpl-system --trim 2  --existing pull

echo "libraries"
gitlab-tools clone --dir ./libs --qp ^farzoom/afinance/fz-.* ^farzoom/common/fz-.* --trim 2 --existing pull

echo "other"
gitlab-tools clone --dir ./ --qp ^farzoom/\(autotests\|configs\|devops\|documentation\|templates\|tools\|data-models\) --trim 1 --existing pull
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
