'use client'

import type { AlternateKind, TemplateAssignments } from '@commerce/core/theme'
import { useState } from 'react'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import { api } from './api-client'

/** What changed, so the editor can refresh its list and follow the open template. */
export type TemplateChange =
  | { type: 'renamed'; kind: AlternateKind; from: string; to: string }
  | { type: 'duplicated'; kind: AlternateKind; suffix: string }
  | { type: 'deleted'; kind: AlternateKind; suffix: string }

/** The alternate a rename or delete dialog is open for. */
export type PendingTemplate = { action: 'rename' | 'delete'; kind: AlternateKind; suffix: string }

const copy = customizeContent.templates

/** First free `<suffix>-copy`, `<suffix>-copy-2`… among the theme's alternates of that kind. */
export function copyName(suffix: string, taken: string[]): string {
  const base = copy.copySuffix(suffix).slice(0, 40)
  if (!taken.includes(base)) return base
  for (let n = 2; n < 100; n++) {
    const next = `${base.slice(0, 37)}-${n}`
    if (!taken.includes(next)) return next
  }
  return `${base.slice(0, 30)}-${Date.now().toString(36)}`
}

/**
 * The template picker's manager: how many resources use each alternate (store-wide), the
 * rename/delete dialog that is open, and the three actions. Each ends in `onChanged`.
 */
export function useTemplateManager(input: {
  themeId: string
  alternates: { template: string; suffix: string }[]
  onChanged: (change: TemplateChange) => void
}) {
  const [assignments, setAssignments] = useState<TemplateAssignments | null>(null)
  const [pending, setPending] = useState<PendingTemplate | null>(null)
  const [busy, setBusy] = useState(false)

  const usedBy = (kind: AlternateKind, suffix: string): number => assignments?.[kind]?.[suffix] ?? 0

  const refresh = () => {
    api.themes.templates
      .assignments()
      .then(setAssignments)
      .catch(() => undefined)
  }

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const duplicate = (kind: AlternateKind, suffix: string) =>
    run(async () => {
      const taken = input.alternates.filter((a) => a.template === kind).map((a) => a.suffix)
      const name = copyName(suffix, taken)
      await api.themes.templates.create({
        themeId: input.themeId,
        template: kind,
        suffix: name,
        basedOn: suffix,
      })
      toast.success(copy.duplicated(name))
      input.onChanged({ type: 'duplicated', kind, suffix: name })
    })

  const rename = (to: string) =>
    run(async () => {
      if (!pending) return
      const { kind, suffix: from } = pending
      await api.themes.templates.rename({ themeId: input.themeId, template: kind, from, to })
      toast.success(copy.renamed)
      setPending(null)
      refresh()
      input.onChanged({ type: 'renamed', kind, from, to })
    })

  const remove = () =>
    run(async () => {
      if (!pending) return
      const { kind, suffix } = pending
      await api.themes.templates.delete({ themeId: input.themeId, template: kind, suffix })
      toast.success(copy.deleted)
      setPending(null)
      input.onChanged({ type: 'deleted', kind, suffix })
    })

  return { usedBy, refresh, pending, setPending, busy, duplicate, rename, remove }
}
