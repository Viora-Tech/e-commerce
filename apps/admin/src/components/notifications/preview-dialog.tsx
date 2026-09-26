'use client'

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
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useEffect, useState } from 'react'
import { notificationsSettingsContent as setupCopy } from '@/data/notifications'
import { api } from '@/lib/api-client'

type PreviewDialogProps = {
  /** The message to preview; null closes the dialog. */
  messageId: string | null
  onClose: () => void
}

type Preview = Awaited<ReturnType<typeof api.notifications.preview>>
type Tab = 'email' | 'whatsapp'

const copy = setupCopy.preview

/** The message filled with a sample order: the email as the customer sees it, and the WhatsApp text. */
export default function PreviewDialog({ messageId, onClose }: PreviewDialogProps) {
  // Hooks
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
        if (live) setPreview(p)
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

  const handleTab = (next: string[]) => {
    const value = next[0]
    if (value === 'email' || value === 'whatsapp') setTab(value)
  }

  // Render logic
  const name = messageId ? (setupCopy.messages[messageId]?.name ?? messageId) : ''

  return (
    <Dialog open={messageId !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[42rem]">
        <DialogHeader>
          <DialogTitle>{copy.title(name)}</DialogTitle>
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
              <ToggleGroup value={[tab]} onValueChange={handleTab} variant="outline" spacing={0}>
                <ToggleGroupItem value="email">{copy.email}</ToggleGroupItem>
                <ToggleGroupItem value="whatsapp">{copy.whatsapp}</ToggleGroupItem>
              </ToggleGroup>
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
          <Button variant="outline" onClick={onClose}>
            {copy.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
