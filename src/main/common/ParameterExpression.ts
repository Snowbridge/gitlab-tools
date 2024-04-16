import * as fs from 'fs'

function* generator() {
    let current = Math.random()
    let increment = Math.random() || 0.000001
    while (true)
        yield current += increment
}
var sequence = generator()
export type ParameterExpressionOperator = '=' | '!=' | '@' | '!@'

export abstract class ParameterExpression {
    private index = sequence.next().value

    protected leftValue: string
    protected operator: ParameterExpressionOperator
    protected rightValue: string
    protected value: any

    constructor(line: string) {
        let regexp = this.getRegexp()

        if (!regexp.test(line))
            throw Error(`Значение параметра не соответствует формату '${this.getRegexp()}'`)

        let tokens = line.match(regexp)

        if (!tokens)
            throw Error(`Эта ошибка никогда не выстрелит потому, что regexp.test() её на самом деле дублирует. 
                            Если выстрелила - плачь. Это значит, что строка регэкспу соответствует,
                            но match() вернул пустоту, чего быть не может`)

        this.leftValue = tokens[1]
        this.operator = tokens[2] as ParameterExpressionOperator || '='
        this.rightValue = `${tokens[3] || tokens[1]}`.replaceAll('+', ' ') // на случай пустого регэспа или регэкспа с количеством групп меньше 3
    }

    getType() { return this.constructor.name }

    getLeftValue() { return this.leftValue }
    getOperator() { return this.operator }
    getRightValue() { return this.rightValue }
    getValue() { return this.value }
    getIndex() { return this.index || 0 }
    setValue(value: any) { this.value = value }

    abstract getRegexp(): RegExp
}

export class QueryAttributeExpression extends ParameterExpression {
    // -q owned=true topics=qwe,rty
    getRegexp(): RegExp { return /^([a-z|0-9|_]+)(=)([^\s]+)$/i }

}

export class QueryMetadataExpression extends ParameterExpression {
    // --qm $.repo-metadata.zones=zone-f
    getRegexp(): RegExp { return /^(\$[a-z|0-9|.|\-|@|?|*|[|\]|,|_]+)(=|!=)([^\s]+)$/ }
}

export class QueryNameExpression extends ParameterExpression {

    // --qn 2316548 --query-name my-super-app
    getRegexp(): RegExp { return /^([^\s]+)$/i }

    constructor(line: string) {
        super(line)
        this.leftValue = ':id'
        this.operator = '='
        this.rightValue = line
    }
}

export class QueryPathExpression extends ParameterExpression {
    // --qp one/two/three --query-path f(oo)+
    getRegexp(): RegExp { return /^([^\s]+)$/i }

    constructor(line: string) {
        super(line)
        this.leftValue = ':path'
        this.operator = '@'
        this.rightValue = line
    }
}

export class UpdateMetadataKeyExpression extends ParameterExpression {
    // -k repo-metadata.team=team:Persimon
    getRegexp(): RegExp { return /^([a-z|0-9|.|\-|@|?|*|[|\]|,|_]+)(=)([^\s]+)$/ }
}

export class UpdateMetadataModelExpression extends ParameterExpression {
    // --model ./path/to/model.yaml
    getRegexp(): RegExp { return /^.+$/i }

    constructor(line: string) {
        super(line)
        this.leftValue = ':model'
        this.operator = '='

        if (!fs.existsSync(line))
            throw Error(`Файл не существует ${line}`)

        this.rightValue = fs.readFileSync(line, 'utf-8')
    }
}

export class UpdateMetadataArrayPushExpression extends ParameterExpression {
    // --push repo-metadata.zones@zone-to-insert
    getRegexp(): RegExp { return /^([a-z|0-9|.|\-|@|?|*|[|\]|,|_]+)(@)([^\s]+)$/ }
}

export class UpdateMetadataArrayRemoveExpression extends ParameterExpression {
    // --remove repo-metadata.zones@zone-to-remove
    getRegexp(): RegExp { return /^([a-z|0-9|.|\-|@|?|*|[|\]|,|_]+)(@)([^\s]+)$/ }
}

export class UpdateMetadataArrayClearExpression extends ParameterExpression {
    // --clear repo-metadata.zones
    getRegexp(): RegExp { return /^([a-z|0-9|.|\-|@|?|*|[|\]|,|_]+)$/ }
}

export class UpdateMetadataDropKeyExpression extends ParameterExpression {
    // --drop repo-metadata.zones
    getRegexp(): RegExp { return /^([a-z|0-9|.|\-|@|?|*|[|\]|,|_]+)$/ }
}

//TODO: add topics attribute