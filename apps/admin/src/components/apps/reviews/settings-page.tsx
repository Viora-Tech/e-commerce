'use client'

import type { ReviewsSettings } from '@commerce/plugin-reviews/settings'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AiSummarySettings from './ai-summary-settings'
import CollectSettings from './collect-settings'
import RewardSettings from './reward-settings'
import ShowSettings from './show-settings'

/** Review settings (Apps, Reviews 20:1408): publishing, who can review, spam, emails, display. */
export default function SettingsPage() {
  // Hooks
  const copy = useCopy(reviewsContent)
  const [form, setForm] = useState<ReviewsSettings | null>(null)
  const [storeName, setStoreName] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api.reviews.settings
      .get()
      .then((s) => {
        setForm(s)
        setSaved(JSON.stringify(s))
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : reviewsContent.list.failed),
      )
    api.store
      .current()
      .then((s) => setStoreName(s?.name ?? ''))
      .catch(() => undefined)
  }, [])

  // Event handlers
  const handlePatch = (patch: Partial<ReviewsSettings>) =>
    setForm((f) => (f ? { ...f, ...patch } : f))
  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      const next = await api.reviews.settings.save(form)
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.settings.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.list.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!form) return <Skeleton className="h-96 w-full rounded-lg" />

  // Render logic
  const dirty = JSON.stringify(form) !== saved

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.settings.title}
        subtitle={copy.settings.subtitle}
        back={{ label: copy.detail.back, href: routes.apps.page('reviews') }}
        actions={
          <Button onClick={handleSave} disabled={busy || !dirty}>
            {busy ? <Spinner /> : <Save aria-hidden="true" />}
            {copy.settings.save}
          </Button>
        }
      />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <CollectSettings value={form} onChange={handlePatch} />
          <RewardSettings value={form} onChange={handlePatch} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <ShowSettings value={form} storeName={storeName} onChange={handlePatch} />
          <AiSummarySettings value={form} onChange={handlePatch} />
        </div>
      </div>
    </div>
  )
}
