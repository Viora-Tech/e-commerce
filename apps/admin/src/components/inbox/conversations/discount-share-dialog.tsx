'use client'

import { BadgePercent } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import EmptyState from '@/components/layout/empty-state'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DiscountShareDialogProps = {
  onClose: () => void
  onShare: (discountId: string) => Promise<void>
}

type Code = Awaited<ReturnType<typeof api.inbox.shareableDiscounts>>[number]

/** Pick one active discount code to share; the shopper applies it to their cart in one tap. */
export default function DiscountShareDialog({ onClose, onShare }: DiscountShareDialogProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const [codes, setCodes] = useState<Code[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api.inbox
      .shareableDiscounts()
      .then((rows) => {
        if (live) setCodes(rows)
      })
      .catch(() => {
        if (live) setCodes([])
      })
    return () => {
      live = false
    }
  }, [])

  // Event handlers
  const handleShare = async (id: string) => {
    setBusy(id)
    try {
      await onShare(id)
    } finally {
      setBusy(null)
    }
  }

  // Render logic
  const d = copy.composer.discountPicker

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{d.title}</DialogTitle>
          <DialogDescription>{d.description}</DialogDescription>
        </DialogHeader>
        {!codes ? (
          <Skeleton className="h-32 w-full" />
        ) : codes.length === 0 ? (
          <EmptyState icon={BadgePercent} heading={d.empty} />
        ) : (
          <ul className="flex max-h-80 flex-col divide-y divide-hairline overflow-y-auto">
            {codes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono text-body-strong">{c.code}</span>
                  <span className="truncate text-caption text-muted-foreground">{c.title}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy === c.id}
                  disabled={busy !== null}
                  onClick={() => handleShare(c.id)}
                >
                  {d.share}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
