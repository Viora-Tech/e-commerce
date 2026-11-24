/**
 * Why an AI call failed, as one log line, before the service answers the merchant with a plain
 * "try again". Without it a schema mismatch, a cut-off answer and a provider error all look the
 * same (the knowledge scan failed for days on 24 Nov with nothing in the logs).
 *
 * Logs error names, the provider's status code, the finish reason and the zod issue paths only:
 * never the prompt, the model's answer (a validation error's message quotes it) or a key.
 */
import { logger } from '@commerce/observability/logging'

type ErrorLike = {
  name?: unknown
  message?: unknown
  cause?: unknown
  statusCode?: unknown
  finishReason?: unknown
  issues?: unknown
  usage?: unknown
}

const asError = (value: unknown): ErrorLike =>
  value && typeof value === 'object' ? (value as ErrorLike) : {}

const str = (value: unknown, max = 200) =>
  typeof value === 'string' ? value.slice(0, max) : undefined

/** Zod issues as `path: code` (e.g. `brands: too_big`), from the error or any cause below it. */
function issuesOf(err: unknown, depth = 0): string[] | undefined {
  const e = asError(err)
  if (Array.isArray(e.issues)) {
    return e.issues.slice(0, 10).map((raw) => {
      const issue = asError(raw) as { path?: unknown; code?: unknown }
      const path = Array.isArray(issue.path) ? issue.path.join('.') : ''
      return `${path || '(root)'}: ${String(issue.code ?? 'invalid')}`
    })
  }
  return depth < 3 && e.cause ? issuesOf(e.cause, depth + 1) : undefined
}

/** The fields logged for a failed AI call. Exported for the test. */
export function modelFailureFields(task: string, err: unknown): Record<string, unknown> {
  const e = asError(err)
  const cause = asError(e.cause)
  // TypeValidationError and JSONParseError quote the model's answer: name only. The AI SDK's
  // NoObjectGeneratedError message is fixed text ("could not parse" / "did not match schema").
  const quotesOutput = /TypeValidation|JSONParse/.test(String(e.name))
  const outputTokens = asError(e.usage) as { outputTokens?: unknown }
  return {
    task,
    errorName: str(e.name) ?? typeof err,
    errorMessage: quotesOutput ? undefined : str(e.message),
    statusCode: typeof e.statusCode === 'number' ? e.statusCode : undefined,
    finishReason: str(e.finishReason),
    outputTokens:
      typeof outputTokens.outputTokens === 'number' ? outputTokens.outputTokens : undefined,
    causeName: str(cause.name),
    issues: issuesOf(err),
  }
}

/** Writes one error line for a failed AI call of `task` (e.g. `store_knowledge_scan`). */
export function logModelFailure(task: string, err: unknown): void {
  logger.error('ai call failed', modelFailureFields(task, err))
}
