import { QueryAttributeExpression, QueryNameExpression, ParameterExpression } from '../main/common/ParameterExpression'
import { applyDefaultActiveQuery } from '../main/infrastructure/cli/common/QueryOptions'

function activeExpressions(expressions: ParameterExpression[]): QueryAttributeExpression[] {
    return expressions.filter(
        (e): e is QueryAttributeExpression => e.getType() === 'QueryAttributeExpression' && e.getLeftValue() === 'active',
    )
}

describe('applyDefaultActiveQuery', () => {
    it('adds active=true by default', () => {
        const expressions: ParameterExpression[] = [new QueryNameExpression('group/repo')]
        applyDefaultActiveQuery({ expressions })
        const active = activeExpressions(expressions)
        expect(active).toHaveLength(1)
        expect(active[0].getRightValue()).toBe('true')
    })

    it('does not add when includeInactive is set', () => {
        const expressions: ParameterExpression[] = []
        applyDefaultActiveQuery({ includeInactive: true, expressions })
        expect(activeExpressions(expressions)).toHaveLength(0)
    })

    it('does not add when -q already specifies active', () => {
        const expressions: ParameterExpression[] = []
        const q = [new QueryAttributeExpression('active=false')]
        applyDefaultActiveQuery({ q, expressions })
        expect(activeExpressions(expressions)).toHaveLength(0)
    })

    it('adds active=true when -q has other attributes only', () => {
        const expressions: ParameterExpression[] = [new QueryAttributeExpression('archived=false')]
        const q = [new QueryAttributeExpression('archived=false')]
        applyDefaultActiveQuery({ q, expressions })
        const active = activeExpressions(expressions)
        expect(active).toHaveLength(1)
        expect(active[0].getRightValue()).toBe('true')
    })
})
