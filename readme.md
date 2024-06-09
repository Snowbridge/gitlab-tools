# Gitlab Tools

Утилита для пакетной обработки репозиториев.

Основные фичи:

1. Отчеты по репозиториям с гибкими отборами по содержимому
2. Пакетное клонирование по списку или по результатам отборов
3. Добавляет метаданные репозиториям в виде yaml-фрагмента в `Description`
4. Манипулирование вебхуками

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
$ git pull git@git.a-fin.tech:l.sadovsky/gitlab-tools.git
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
$ git pull git@git.a-fin.tech:l.sadovsky/gitlab-tools.git
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

## Пример использования отбора по метаданным

Предположим, у нас в описаниях репозиториев содержится YAML с ниже описанной структурой:

```yaml
repo-metadata:
    type: service
    team: TeamA
    zones:
        - zone-a
        - zone-f
    some:
        deeply:
            nested-key: cryptic value
    not-so-deeply:
        nested-key: some long line of text with spaces
```

```bash
# склонировать в каталог `./zone-f-repos` все репы, у которых есть значение `zone-f` в коллекции `repo-metadata.zones`
$ gitlab-tools clone -d ./zone-f-repos --qm $.repo-metadata.zones=zone-f

# вывести на консоль все репы, у которых `repo-metadata.team` содержит что угодно, кроме `TeamB`
$ gitlab-tools report --qm $.repo-metadata.team!=TeamB

# фильтры объединяются по ИЛИ, то есть вот это склонирует в текущую папку все репы, у которых (одновременно)
# `repo-metadata.zones` не содержит `zone-a`, а так же все репы, у которых `repo-metadata.team` содержит `TeamA`
$ gitlab-tools clone -d ./ --qm $.repo-metadata.zones!=zone-a --qm $.repo-metadata.team=TeamA

# Этот запрос соберет все проекты, у которых в ключах `nested-key` на любом уровне вложенности содержится
# что угодно, кроме строки 'cryptic value'
# NB! плюсы в параметрах командной строки заменяются на пробелы (ну, просто потому что вот так вот я решил)
$ gitlab-tools report --qm $..nested-key!=cryptic+value
```

## Usage example

Если вот такой скрипт сложить в файл, например, `afinance.sh`, то при первом запуске он вытащит весь А.Финанс и разложит по папкам, а при всех последдующих будет клонить недостающие, а существующие будет фетчить:

```bash
echo "./100-Main/"
gitlab-tools clone --dir ./100-Main/ --existing fetch --trim 1 --qp farzoom/afinance/ farzoom/common/ farzoom/afinance-poas-system/ farzoom/afinance-rate/ farzoom/afinance-spr/ farzoom/afinance-tmpl-system/

echo "./200-Documentation/"
gitlab-tools clone --dir ./200-Documentation/ --existing fetch --trim 2 --qp farzoom/documentation/

echo "./300-Configs/"
gitlab-tools clone --dir ./200-Configs/ --existing fetch --trim 2 --qp farzoom/configs/

echo "./400-Testing/"
gitlab-tools clone --dir ./300-Testing/ --existing fetch --trim 2 --qp farzoom/autotests/

echo "./500-Infra/"
gitlab-tools clone --dir ./400-Infra/ --existing fetch --trim 1 --qp farzoom/afinance-2.0/ farzoom/devops/

echo "./800-Legacy/"
gitlab-tools clone --dir ./800-Legacy/ --existing fetch --trim 2 --qp farzoom/legacy/

echo "./900-Personal/"
gitlab-tools clone --dir ./900-Personal/ --existing fetch -q owned=true

echo "Done"
```

С последним пунктом внимательнее, т.к. это не именно личные, а все, у кого вы `owner`. Хотя беды и не будет, конечно.
