'use client'

import type { EmailBranding } from '@commerce/core'
import { ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import InlineState from '@/components/states/inline-state'
import { emailBrandingContent } from '@/data/email-branding'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type BrandingPreviewProps = {
  /** The emails to flip through, first shown first. */
  emails: { id: string; name: string }[]
  branding: EmailBranding
}

type PreviewId = Parameters<typeof api.notifications.previewBranding>[0]['id']
type Preview = { subject: string; html: string }

/** Waits for a pause in dragging the slider or typing a colour before drawing again. */
const DEBOUNCE_MS = 350

/**
 * Email branding's live preview: one email at a time with the branding not saved yet, and ← →
 * to flip through the store's emails, like Shopify's "Customize email templates".
 */
export default function BrandingPreview({ emails, branding }: BrandingPreviewProps) {
  // Hooks
  const copy = useCopy(emailBrandingContent)
  const [index, setIndex] = useState(0)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Derived values
  const email = emails[index] ?? emails[0]

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` (Try again) re-runs it
  useEffect(() => {
    if (!email) return
    let live = true
    const timer = setTimeout(() => {
      api.notifications
        .previewBranding({ id: email.id as PreviewId, branding })
        .then((p) => {
          if (!live) return
          setPreview(p)
          setFailed(false)
        })
        .catch(() => {
          if (live) setFailed(true)
        })
    }, DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [email, branding, attempt])

  // Event handlers
  const handleStep = (by: number) =>
    setIndex((i) => (i + by + emails.length) % Math.max(emails.length, 1))

  // Render logic
  const p = copy.preview

  return (
    <DataCard
      title={email?.name ?? p.title}
      subtitle={p.help}
      action={
        <span className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={p.previous}
            disabled={emails.length < 2}
            onClick={() => handleStep(-1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={p.next}
            disabled={emails.length < 2}
            onClick={() => handleStep(1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </span>
      }
    >
      {failed ? (
        <InlineState kind="error" heading={p.failed} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !preview ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">{p.loading}</span>
          <Skeleton className="h-[40rem] w-full" />
        </div>
      ) : (
        <iframe
          title={p.frameTitle(email?.name ?? '')}
          srcDoc={preview.html}
          sandbox=""
          className="h-[70dvh] min-h-[32rem] w-full rounded-lg border border-border bg-white"
        />
      )}
    </DataCard>
  )
}
