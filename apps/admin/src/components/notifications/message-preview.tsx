'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import InlineState from '@/components/states/inline-state'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'

type MessagePreviewProps = {
  messageId: string
  /** The message's name, for the frame's title. */
  name: string
}

type PreviewId = Parameters<typeof api.notifications.preview>[0]['id']
type Tab = 'email' | 'whatsapp'

/**
 * The message filled with a sample order, as the customer gets it: the subject over the email,
 * and the WhatsApp text in its own tab when the message has one. Nothing is sent.
 */
export default function MessagePreview({ messageId, name }: MessagePreviewProps) {
  // Hooks
  const { preview: copy } = useCopy(notificationsSettingsContent)
  const [picked, setPicked] = useState<Tab | null>(null)
  const {
    data: preview,
    failed,
    retry,
  } = useLoad(() => api.notifications.preview({ id: messageId as PreviewId }), [messageId])

  // Early returns
  if (failed) return <InlineState kind="error" heading={copy.failed} onRetry={retry} />
  if (!preview) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="sr-only">{copy.loading}</span>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-[32rem] w-full" />
      </div>
    )
  }

  // Render logic
  const tab: Tab = picked ?? 'email'

  return (
    <div className="flex flex-col gap-3">
      {preview.whatsapp ? (
        <PillTabs
          variant="underline"
          tabs={[
            { value: 'email' as const, label: copy.email },
            { value: 'whatsapp' as const, label: copy.whatsapp },
          ]}
          value={tab}
          onChange={setPicked}
          className="border-b border-border"
        />
      ) : null}
      {tab === 'email' ? (
        <>
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-body">
            <span className="text-muted-foreground">{copy.subject}: </span>
            <span className="font-medium text-foreground">{preview.subject}</span>
          </p>
          <iframe
            title={copy.frameTitle(name)}
            srcDoc={preview.html}
            sandbox=""
            className="h-[75dvh] min-h-[32rem] w-full rounded-lg border border-border bg-white"
          />
        </>
      ) : (
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="max-w-[28rem] whitespace-pre-wrap rounded-lg bg-card p-3 text-body text-foreground shadow-sm">
            {preview.whatsapp}
          </p>
        </div>
      )}
    </div>
  )
}
