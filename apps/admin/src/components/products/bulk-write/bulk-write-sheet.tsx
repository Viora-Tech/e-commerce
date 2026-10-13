'use client'

import type { BulkWriteField, WriterLanguage, WriterTone } from '@commerce/ai/client'
import { AiIcon } from '@commerce/ui/icons'
import { Progress } from '@commerce/ui/shadcn/progress'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@commerce/ui/shadcn/sheet'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import { assistantContent } from '@/data/assistant'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import BulkWriteOptions from './bulk-write-options'
import BulkWriteReview from './bulk-write-review'

type Job = Awaited<ReturnType<typeof api.ai.bulkJob>>

type BulkWriteSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A new run for these products, or null to show `jobId`. */
  productIds: string[] | null
  jobId: string | null
  onApplied: () => void
  /** What to write when the sheet opens (the SEO report preselects what it found missing). */
  initialFields?: BulkWriteField[] | undefined
}

const POLL_MS = 1_500
const LIVE = new Set(['queued', 'running'])

/**
 * Bulk "Write with AI": pick what to write, start a background run, watch it go product by
 * product, then tick what to keep and apply. Nothing is saved until Apply, and an applied run
 * can be undone from Settings → AI → Activity.
 */
export default function BulkWriteSheet({
  open,
  onOpenChange,
  productIds,
  jobId,
  onApplied,
  initialFields,
}: BulkWriteSheetProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const locale = useLocale()
  const [fields, setFields] = useState<BulkWriteField[]>(
    initialFields ?? ['description', 'seo', 'tags'],
  )
  const [language, setLanguage] = useState<WriterLanguage>(locale === 'hi' ? 'hi' : 'en')
  const [tone, setTone] = useState<WriterTone>('friendly')
  const [job, setJob] = useState<Job | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  /** Suggestions already offered, so a product the merchant unticked stays unticked. */
  const seen = useRef(new Set<string>())

  useEffect(() => {
    if (!open) return
    setSelected([])
    seen.current = new Set()
    if (!jobId) {
      setJob(null)
      return
    }
    api.ai
      .bulkJob({ id: jobId })
      .then(setJob)
      .catch(() => setJob(null))
  }, [open, jobId])

  // Polls while the run is writing; each answer is a new `job`, which schedules the next.
  useEffect(() => {
    if (!open || !job || !LIVE.has(job.status)) return
    const timer = setTimeout(() => {
      api.ai
        .bulkJob({ id: job.id })
        .then(setJob)
        .catch(() => undefined)
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [open, job])

  // Ticks every newly written product by default.
  useEffect(() => {
    if (!job) return
    const ready = job.items.filter((i) => i.status === 'ready').map((i) => i.id)
    const fresh = ready.filter((id) => !seen.current.has(id))
    for (const id of fresh) seen.current.add(id)
    setSelected((prev) => [...prev, ...fresh].filter((id) => ready.includes(id)))
  }, [job])

  // Event handlers
  const handleStart = async () => {
    if (!productIds?.length || !fields.length) return
    setBusy(true)
    try {
      setJob(await api.ai.bulkWrite({ productIds, fields, language, tone }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleStop = async () => {
    if (!job) return
    await api.ai.cancelBulk({ id: job.id }).catch(() => undefined)
    setJob(await api.ai.bulkJob({ id: job.id }))
  }

  const handleApply = async () => {
    if (!job || !selected.length) return
    setBusy(true)
    try {
      const result = await api.ai.applyBulk({
        jobId: job.id,
        itemIds: selected,
        fields: job.options.fields,
      })
      toast.success(copy.bulk.applied(result.applied))
      onApplied()
      setJob(await api.ai.bulkJob({ id: job.id }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const live = job !== null && LIVE.has(job.status)
  const finished = (job?.done ?? 0) + (job?.failed ?? 0)
  const count = job?.total ?? productIds?.length ?? 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-line border-b pr-12">
          <SheetTitle className="flex items-center gap-2">
            <AiIcon className="size-5 text-primary" aria-hidden="true" />
            {copy.bulk.title}
          </SheetTitle>
          <SheetDescription>{copy.bulk.subtitle(count)}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 md:p-5">
          {job ? (
            <>
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3.5">
                <div className="flex items-center justify-between gap-3 text-body">
                  <span className="flex items-center gap-2 font-medium text-ink-strong">
                    {live ? <Spinner /> : null}
                    {copy.bulk.runStatus[job.status] ?? job.status}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {copy.bulk.progress(finished, job.total)}
                  </span>
                </div>
                <Progress value={job.total ? (finished / job.total) * 100 : 0} />
                {live ? (
                  <p className="text-caption text-muted-foreground">{copy.bulk.background}</p>
                ) : null}
                {job.error ? <p className="text-caption text-destructive">{job.error}</p> : null}
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="text-body font-semibold text-ink-strong">
                  {copy.bulk.reviewHeading}
                </h3>
                <p className="text-caption text-muted-foreground">{copy.bulk.reviewHint}</p>
              </div>
              <BulkWriteReview job={job} selected={selected} onSelected={setSelected} />
            </>
          ) : (
            <>
              <BulkWriteOptions
                fields={fields}
                language={language}
                tone={tone}
                disabled={busy}
                onFields={setFields}
                onLanguage={setLanguage}
                onTone={setTone}
              />
              <p className="text-caption text-muted-foreground">{copy.bulk.cost(count)}</p>
            </>
          )}
        </div>
        <SheetFooter className="flex-row flex-wrap justify-end border-line border-t">
          {job ? (
            <>
              {live ? (
                <KitButton variant="secondary" onClick={() => void handleStop()}>
                  {copy.bulk.cancelRun}
                </KitButton>
              ) : (
                <KitButton variant="secondary" onClick={() => onOpenChange(false)}>
                  {copy.bulk.close}
                </KitButton>
              )}
              <KitButton
                variant="primary"
                onClick={() => void handleApply()}
                disabled={busy || !selected.length}
              >
                {busy ? <Spinner /> : null}
                {copy.bulk.apply(selected.length)}
              </KitButton>
            </>
          ) : (
            <KitButton
              variant="primary"
              onClick={() => void handleStart()}
              disabled={busy || !fields.length || !productIds?.length}
            >
              {busy ? <Spinner /> : <AiIcon className="size-4" aria-hidden="true" />}
              {busy ? copy.bulk.starting : copy.bulk.start}
            </KitButton>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
