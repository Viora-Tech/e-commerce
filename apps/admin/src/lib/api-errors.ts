/** Per-field messages an API validation failure carries in `data.errors`, keyed by field. */
export function fieldErrorsOf(err: unknown): Record<string, string> {
  const data = (err as { data?: { errors?: Record<string, string> } } | null)?.data
  return data?.errors ?? {}
}
