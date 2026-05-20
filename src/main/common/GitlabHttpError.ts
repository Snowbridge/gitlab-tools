import { isAxiosError } from 'axios'
import { httpClientLogger } from './Logger'

const MAX_BODY_LENGTH = 4096

export class GitlabHttpError extends Error {
    readonly status?: number
    readonly responseBody?: string

    constructor(message: string, status?: number, responseBody?: string) {
        super(message)
        this.name = 'GitlabHttpError'
        this.status = status
        this.responseBody = responseBody
    }
}

export function formatResponseBody(data: unknown): string {
    if (data === undefined || data === null)
        return ''
    const text =
        typeof data === 'string'
            ? data
            : JSON.stringify(data)
    if (text.length <= MAX_BODY_LENGTH)
        return text
    return `${text.slice(0, MAX_BODY_LENGTH)}…`
}

export function formatHttpErrorMessage(error: unknown): string {
    if (isAxiosError(error) && error.response) {
        const status = error.response.status
        const body = formatResponseBody(error.response.data)
        return body.length > 0 ? `HTTP ${status}: ${body}` : `HTTP ${status}`
    }
    if (error instanceof Error)
        return error.message
    return String(error)
}

function redactAuthorization(value: unknown): unknown {
    if (!value || typeof value !== 'object')
        return value
    const clone = { ...(value as Record<string, unknown>) }
    if (typeof clone.Authorization === 'string')
        clone.Authorization = 'Bearer ***'
    if (typeof clone.authorization === 'string')
        clone.authorization = 'Bearer ***'
    return clone
}

function redactErrorForLog(error: unknown): unknown {
    if (!isAxiosError(error))
        return error
    return {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack,
        config: error.config
            ? {
                  ...error.config,
                  headers: redactAuthorization(error.config.headers),
              }
            : undefined,
        request: error.request,
        response: error.response
            ? {
                  status: error.response.status,
                  statusText: error.response.statusText,
                  headers: error.response.headers,
                  data: error.response.data,
              }
            : undefined,
    }
}

export function logHttpErrorFull(error: unknown): void {
    httpClientLogger.error({ error: redactErrorForLog(error) })
}

export function toGitlabHttpError(error: unknown): GitlabHttpError {
    if (error instanceof GitlabHttpError)
        return error
    if (isAxiosError(error) && error.response) {
        const status = error.response.status
        const responseBody = formatResponseBody(error.response.data)
        return new GitlabHttpError(
            formatHttpErrorMessage(error),
            status,
            responseBody,
        )
    }
    return new GitlabHttpError(formatHttpErrorMessage(error))
}

export function logParseResponseError(data: unknown, parseError: unknown): void {
    httpClientLogger.error({
        message: 'Unexpected response data format',
        data,
        error: parseError,
    })
}

export function formatParseResponseError(data: unknown): string {
    const preview =
        typeof data === 'string'
            ? data.slice(0, 200)
            : formatResponseBody(data).slice(0, 200)
    return `Unexpected response data format: ${preview}`
}
