import type { AppSummary } from '@/components/apps/app-card'
import type { AppKind, appsContent } from '@/data/apps'

const KINDS = ['payments', 'shipping', 'notifications', 'storage'] as const satisfies AppKind[]

/** What an app does in the store, in plain words, from its manifest (what it provides, listens to, adds). */
export function permissionLines(app: AppSummary, copy: typeof appsContent): string[] {
  const lines: string[] = []
  for (const kind of KINDS) {
    const labels = app.provides[kind].map((p) => p.label).join(', ')
    if (labels) lines.push(copy.permissions.kindLine[kind](labels))
  }
  if (app.hooks.length > 0) lines.push(copy.permissions.hooks)
  if (app.productFields.length > 0) lines.push(copy.permissions.fields)
  if (app.admin.pages.length > 0) lines.push(copy.permissions.pages)
  return lines
}
