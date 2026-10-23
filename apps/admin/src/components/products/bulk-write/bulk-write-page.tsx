'use client'

import {
  type BulkWriteField,
  bulkCallsPerProduct,
  type WriterLanguage,
  type WriterTone,
} from '@commerce/ai/client'
import { AiIcon } from '@commerce/ui/icons'
import { Progress } from '@commerce/ui/shadcn/progress'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { assistantContent } from '@/data/assistant'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type BulkWriteFrom, routes } from '@/lib/routes'
import BulkWriteOptions from './bulk-write-options'
import BulkWriteReview from './bulk-write-review'

type Job = Awaited<ReturnType<typeof api.ai.bulkJob>>

type BulkWritePageProps = {
  /** A new run for these products, or null to show `jobId`. */
  productIds: string[] | null
  jobId: string | null
  /** What to write at first (the SEO report preselects what it found missing). */
  initialFields?: BulkWriteField[] | undefined
  /** The page that sent the merchant here, for the back link and Close. */
  from: BulkWriteFrom
}

const POLL_MS = 1_500
const LIVE = new Set(['queued', 'running'])

const BACK: Record<BulkWriteFrom, () => string> = {
  products: routes.products.list,
  seo: routes.onlineStore.seo,
  readiness: routes.salesChannels.agenticReadiness,
}

/**
 * Products → Write with AI, on its own page: pick what to write, start a background run, watch
 * it go product by product, then tick what to keep and apply. The run's id goes in the address,
 * so leaving and coming back (or the products banner) reopens it. Nothing is saved until
 * Apply, and an applied run can be undone from Settings → AI → Activity.
 */
export default function BulkWritePage({
  productIds,
  jobId,
  initialFields,
  from,
}: BulkWritePageProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const locale = useLocale()
  const router = useRouter()
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
    if (!jobId) return
    api.ai
      .bulkJob({ id: jobId })
      .then(setJob)
      .catch(() => setJob(null))
  }, [jobId])

  // Polls while the run is writing; each answer is a new `job`, which schedules the next.
  useEffect(() => {
    if (!job || !LIVE.has(job.status)) return
    const timer = setTimeout(() => {
      api.ai
        .bulkJob({ id: job.id })
        .then(setJob)
        .catch(() => undefined)
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [job])

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
      const started = await api.ai.bulkWrite({ productIds, fields, language, tone })
      setJob(started)
      router.replace(routes.products.bulkWrite({ job: started.id, from }))
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
  const backHref = BACK[from]()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.bulk.title}
        subtitle={copy.bulk.subtitle(count)}
        back={{ label: copy.bulk.backTo[from], href: backHref }}
      />
      <DataCard
        title={job ? copy.bulk.reviewHeading : copy.bulk.optionsHeading}
        subtitle={job ? copy.bulk.reviewHint : undefined}
        icon={<AiIcon aria-hidden="true" />}
        bodyClassName="flex flex-col gap-5"
        footer={
          job ? (
            <>
              {live ? (
                <KitButton variant="secondary" onClick={() => void handleStop()}>
                  {copy.bulk.cancelRun}
                </KitButton>
              ) : (
                <KitButton variant="secondary" onClick={() => router.push(backHref)}>
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
          )
        }
      >
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
            <p className="text-caption text-muted-foreground">
              {copy.bulk.cost(count, bulkCallsPerProduct(fields))}
            </p>
          </>
        )}
      </DataCard>
    </div>
  )
}
