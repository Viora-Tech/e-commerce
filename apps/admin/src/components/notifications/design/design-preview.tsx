'use client'

import type { EmailTemplateDesign } from '@commerce/notifications/design'
import { cn } from '@commerce/ui/lib/utils'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DesignPreviewProps = {
  messageId: string
  design: EmailTemplateDesign
}

type Device = 'desktop' | 'mobile'
type Preview = { subject: string; html: string }
type DesignId = Parameters<typeof api.notifications.previewDesign>[0]['id']

/** Waits for a pause in typing before drawing the email again. */
const DEBOUNCE_MS = 400

/**
 * The email as it is being designed, filled with the sample order and drawn by the server with
 * the same renderer that sends it. Desktop or phone width.
 */
export default function DesignPreview({ messageId, design }: DesignPreviewProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const [device, setDevice] = useState<Device>('desktop')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let live = true
    setLoading(true)
    const timer = setTimeout(() => {
      api.notifications
        .previewDesign({ id: messageId as DesignId, design })
        .then((p) => {
          if (!live) return
          setPreview(p)
          setFailed(false)
        })
        .catch(() => {
          if (live) setFailed(true)
        })
        .finally(() => {
          if (live) setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [messageId, design])

  // Render logic
  const p = copy.preview

  return (
    <section aria-label={p.title} className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-caption font-semibold text-muted-foreground">{p.title}</h3>
        <PillTabs
          label={p.title}
          tabs={[
            { value: 'desktop' as const, label: p.desktop },
            { value: 'mobile' as const, label: p.mobile },
          ]}
          value={device}
          onChange={setDevice}
        />
      </div>
      {preview ? (
        <p className="truncate text-body">
          <span className="text-muted-foreground">{p.subject}: </span>
          <span className="font-medium text-foreground">{preview.subject}</span>
        </p>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {loading ? p.loading : ''}
      </span>
      {failed ? <p className="text-body text-destructive">{p.failed}</p> : null}
      <div className="flex min-h-[24rem] flex-1 justify-center overflow-auto rounded-lg border border-border bg-muted p-2">
        {preview ? (
          <iframe
            title={p.frameTitle}
            srcDoc={preview.html}
            sandbox=""
            className={cn(
              'h-full min-h-[24rem] rounded-md bg-card transition-[width,opacity] duration-200',
              device === 'mobile' ? 'w-[23.4375rem]' : 'w-full',
              loading && 'opacity-70',
            )}
          />
        ) : (
          <Skeleton className="h-full min-h-[24rem] w-full" />
        )}
      </div>
    </section>
  )
}
