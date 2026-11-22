'use client'

import type { SeoAssistantResource } from '@commerce/core/seo-assistant'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { seoAssistantContent } from '@/data/seo-assistant'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import SeoDraftCard, { type SeoDraftState } from './seo-draft-card'

/** An item to fix, with its listing now (the "before" side of the preview). */
export type SeoFixTarget = {
  resource: SeoAssistantResource
  id: string
  title: string
  seoTitle: string | null
  seoDescription: string | null
}

type SeoFixDialogProps = {
  targets: SeoFixTarget[]
  onClose: () => void
  onApplied: () => void
}

type DraftResult = Awaited<ReturnType<typeof api.seo.assistantDraft>>[number]

const keyOf = (t: Pick<SeoFixTarget, 'resource' | 'id'>) => `${t.resource}:${t.id}`

function toState(target: SeoFixTarget, result: DraftResult | undefined): SeoDraftState {
  if (!result?.ok) {
    return { target, failed: result?.reason ?? 'model_failed', include: false }
  }
  return {
    target,
    failed: null,
    include: true,
    seoTitle: result.seoTitle,
    seoDescription: result.seoDescription,
    snippet: result.snippet,
    snippetWords: result.snippetWords,
    queries: result.queries,
  }
}

/**
 * "Fix with AI": drafts new search listings for the chosen items, shows each beside what Google
 * shows now (editable), and writes only the ticked ones on Apply. Closing drops the drafts.
 */
export default function SeoFixDialog({ targets, onClose, onApplied }: SeoFixDialogProps) {
  // Hooks
  const copy = useCopy(seoAssistantContent.fix)
  const [drafts, setDrafts] = useState<SeoDraftState[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api.seo
      .assistantDraft({ items: targets.map((t) => ({ resource: t.resource, id: t.id })) })
      .then((results) => {
        if (!live) return
        const byKey = new Map(results.map((r) => [keyOf(r), r]))
        setDrafts(targets.map((t) => toState(t, byKey.get(keyOf(t)))))
      })
      .catch((err: unknown) => {
        if (live) setError(errorText(err, copy.failed))
      })
    return () => {
      live = false
    }
  }, [targets, copy.failed])

  // Helpers
  const update = (key: string, next: SeoDraftState) =>
    setDrafts((prev) => prev?.map((d) => (keyOf(d.target) === key ? next : d)) ?? prev)

  // Event handlers
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }
  const handleApply = async () => {
    const changes = (drafts ?? [])
      .filter((d) => d.include && d.failed === null)
      .map((d) => ({
        resource: d.target.resource,
        id: d.target.id,
        seoTitle: d.seoTitle ?? '',
        seoDescription: d.seoDescription ?? '',
      }))
    if (changes.length === 0) return
    try {
      const { applied } = await api.seo.assistantApply({ changes })
      toast.success(copy.applied(applied))
      onApplied()
    } catch (err) {
      toast.error(errorText(err, copy.applyFailed))
      throw err
    }
  }

  // Render logic
  const picked = (drafts ?? []).filter((d) => d.include && d.failed === null).length

  return (
    <FormDialog
      open
      onOpenChange={handleOpenChange}
      size="wide"
      title={copy.title(targets.length)}
      description={copy.description}
      submitLabel={copy.apply(picked)}
      submitDisabled={picked === 0}
      dirty={drafts !== null}
      onSubmit={handleApply}
    >
      {error ? (
        <p className="text-body text-danger">{error}</p>
      ) : drafts === null ? (
        <div className="flex items-center gap-2 py-8 text-body text-muted-foreground">
          <Spinner className="size-4" />
          {copy.working}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {drafts.map((d) => (
            <SeoDraftCard
              key={keyOf(d.target)}
              draft={d}
              onChange={(next) => update(keyOf(d.target), next)}
            />
          ))}
        </div>
      )}
    </FormDialog>
  )
}
