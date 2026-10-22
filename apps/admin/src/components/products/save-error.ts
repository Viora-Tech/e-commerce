import type { productFormContent } from '@/data/product-form'
import { validationIssuesOf } from '@/lib/api-errors'

type Copy = typeof productFormContent

/** A failed product save in plain words: the first few fields the server turned down, else its message. */
export function saveErrorMessage(copy: Copy, err: unknown): string {
  const issues = validationIssuesOf(err)
  if (!issues.length) return err instanceof Error ? err.message : copy.toasts.failed
  return issues
    .slice(0, 3)
    .map((i) => {
      const field = copy.errors.fields[i.path.split('.')[0] ?? ''] ?? copy.errors.fieldFallback
      return copy.errors.invalidField(
        field,
        i.max === undefined ? i.message : copy.errors.tooLong(i.max),
      )
    })
    .join('. ')
}
