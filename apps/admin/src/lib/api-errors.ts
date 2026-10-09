/** Per-field messages an API validation failure carries in `data.errors`, keyed by field. */
export function fieldErrorsOf(err: unknown): Record<string, string> {
  const data = (err as { data?: { errors?: Record<string, string> } } | null)?.data
  return data?.errors ?? {}
}

export type ValidationIssue = {
  /** Dotted path into the request, e.g. `variants.0.sku`. */
  path: string
  message: string
  /** Set for "too big" issues on text or lists: the limit that was exceeded. */
  max?: number
}

/** The zod issues an API "Input validation failed" error carries in `data.issues`. */
export function validationIssuesOf(err: unknown): ValidationIssue[] {
  const issues = (err as { data?: { issues?: unknown } } | null)?.data?.issues
  if (!Array.isArray(issues)) return []
  return issues.map((raw) => {
    const i = raw as { message?: string; path?: unknown[]; code?: string; maximum?: number }
    const path = (i.path ?? [])
      .map((p) => (typeof p === 'object' && p !== null ? (p as { key: unknown }).key : p))
      .join('.')
    const issue: ValidationIssue = { path, message: i.message ?? '' }
    if (i.code === 'too_big' && typeof i.maximum === 'number') issue.max = i.maximum
    return issue
  })
}
