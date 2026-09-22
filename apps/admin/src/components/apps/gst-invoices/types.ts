import type { InvoiceSettings } from '@commerce/invoices'

/** What every settings group edits: the whole settings object, patched immutably. */
export type GroupProps = {
  settings: InvoiceSettings
  onChange: (next: InvoiceSettings) => void
  errors: Record<string, string>
}

export type MediaRef = { id: string; url: string } | null

/** Zod issues keyed by dotted path, e.g. `seller.gstin`. */
export function issuesByPath(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  return Object.fromEntries(issues.map((i) => [i.path.map(String).join('.'), i.message]))
}
