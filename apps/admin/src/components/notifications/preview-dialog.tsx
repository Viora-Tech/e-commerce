'use client'

import { Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type PreviewDialogProps = {
  /** The message to preview; null closes the dialog. */
  messageId: string | null
  onClose: () => void
  /** Sends this message to you, the same as the row's "Send me a test". */
  onTest: () => void
  testing: boolean
}

type Preview = Awaited<ReturnType<typeof api.notifications.preview>>
type Tab = 'email' | 'whatsapp'

/** The message filled with a sample order: the WhatsApp text (when it has one) and the email as the customer sees them. */
export default function PreviewDialog({ messageId, onClose, onTest, testing }: PreviewDialogProps) {
  // Hooks
  const setupCopy = useCopy(notificationsSettingsContent)
  const { preview: copy } = useCopy(notificationsSettingsContent)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<Tab>('email')

  useEffect(() => {
    if (!messageId) return
    let live = true
    setPreview(null)
    setFailed(false)
    setTab('email')
    api.notifications
      .preview({ id: messageId as Parameters<typeof api.notifications.preview>[0]['id'] })
      .then((p) => {
        if (!live) return
        setPreview(p)
        if (p.whatsapp) setTab('whatsapp')
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [messageId])

  // Event handlers
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  // Render logic
  const name = messageId ? (setupCopy.messages[messageId]?.name ?? messageId) : ''

  return (
    <Dialog open={messageId !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[42rem]">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{copy.help}</DialogDescription>
        </DialogHeader>
        {failed ? (
          <p className="text-body text-destructive">{copy.failed}</p>
        ) : !preview ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <span className="sr-only">{copy.loading}</span>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-[20rem] w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {preview.whatsapp ? (
              <PillTabs
                variant="underline"
                tabs={[
                  { value: 'whatsapp' as const, label: copy.whatsapp },
                  { value: 'email' as const, label: copy.email },
                ]}
                value={tab}
                onChange={setTab}
                className="border-b border-border"
              />
            ) : null}
            {tab === 'email' ? (
              <>
                <p className="text-body">
                  <span className="text-muted-foreground">{copy.subject}: </span>
                  <span className="font-medium text-foreground">{preview.subject}</span>
                </p>
                <iframe
                  title={copy.frameTitle(name)}
                  srcDoc={preview.html}
                  sandbox=""
                  className="h-[60dvh] min-h-[18rem] w-full rounded-lg border border-border"
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
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTest} disabled={testing}>
            {testing ? <Spinner /> : <Send aria-hidden="true" />}
            {copy.sendTest}
          </Button>
          <Button onClick={onClose}>{copy.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
