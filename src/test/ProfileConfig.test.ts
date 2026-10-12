import {
    maskProfileBodyForDisplay,
    parseDebugValue,
    parseProfileFile,
    rawToRuntime,
} from '../main/common/ProfileConfig'

describe('ProfileConfig', () => {
    test('parseProfileFile skips comments and empty lines', () => {
        const raw = parseProfileFile(`
# comment
HOST=gitlab.example.com
TOKEN=secret

PORT=443
`)
        expect(raw.HOST).toBe('gitlab.example.com')
        expect(raw.TOKEN).toBe('secret')
        expect(raw.PORT).toBe('443')
    })

    test('rawToRuntime applies defaults', () => {
        const cfg = rawToRuntime({ HOST: 'h', TOKEN: 't' })
        expect(cfg.host).toBe('h')
        expect(cfg.token).toBe('t')
        expect(cfg.port).toBe(443)
        expect(cfg.onError).toBe('retry')
        expect(cfg.retries).toBe(3)
        expect(cfg.debug).toBe(false)
    })

    test('parseDebugValue', () => {
        expect(parseDebugValue('true')).toBe(true)
        expect(parseDebugValue('1')).toBe(true)
        expect(parseDebugValue('yes')).toBe(true)
        expect(parseDebugValue('false')).toBe(false)
        expect(parseDebugValue(undefined)).toBe(false)
    })

    test('maskProfileBodyForDisplay masks TOKEN', () => {
        const body = 'HOST=h\nTOKEN=abcdefghijklmnop\n'
        expect(maskProfileBodyForDisplay(body, false)).toContain('TOKEN=abcd********')
        expect(maskProfileBodyForDisplay(body, true)).toBe(body.trimEnd())
    })
})
