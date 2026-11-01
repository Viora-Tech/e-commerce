'use client'

import { formatGiftCardCode } from '@commerce/core/gift-cards'
import { CheckIcon, Copy } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { giftCardIssueContent } from '@/data/gift-cards'

export type IssuedCard = {
  id: string
  code: string
  delivery: { to: string; ok: boolean; error?: string | undefined }[]
}

type CodeRevealDialogProps = {
  issued: IssuedCard | null
  onDone: (id: string) => void
}

const copy = giftCardIssueContent.reveal

/** Shows a new card's full code once, with copy, and whether the email went out. */
export default function CodeRevealDialog({ issued, onDone }: CodeRevealDialogProps) {
  // Event handlers
  const handleCopy = async () => {
    if (!issued) return
    await navigator.clipboard.writeText(issued.code)
    toast.success(copy.copied)
  }

  // Render logic
  const sent = issued?.delivery.find((d) => d.ok)
  const failed = issued?.delivery.find((d) => !d.ok)

  return (
    <Dialog open={issued !== null} onOpenChange={(open) => !open && issued && onDone(issued.id)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <span className="whitespace-nowrap font-mono text-base tracking-widest text-ink-strong">
            {issued ? formatGiftCardCode(issued.code) : ''}
          </span>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="size-4" />
            {copy.copy}
          </Button>
        </div>
        {sent ? <p className="text-caption text-success">{copy.sent(sent.to)}</p> : null}
        {!sent && failed?.error ? (
          <p className="text-caption text-destructive">{copy.notSent(failed.error)}</p>
        ) : null}
        <DialogFooter>
          <Button onClick={() => issued && onDone(issued.id)}>
            <CheckIcon aria-hidden="true" />
            {copy.done}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
