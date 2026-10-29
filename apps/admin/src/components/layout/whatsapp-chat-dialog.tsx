'use client'

import type { WhatsappChatTemplate } from '@commerce/core'
import { WhatsappLogo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { whatsappChatContent } from '@/data/whatsapp-chat'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { whatsappChatUrl } from '@/lib/customer-contact'
import {
  chatTemplatesFor,
  chatVars,
  defaultChatTemplate,
  type WhatsappChatInfo,
  type WhatsappChatTarget,
} from '@/lib/whatsapp-chat'

type WhatsappChatDialogProps = {
  open: boolean
  /** What the chat is about (drafts are orders). */
  kind: WhatsappChatTarget['kind']
  id: string
  onClose: () => void
  /** The chat was opened and noted on the timeline: reload the page's data. */
  onOpened?: (() => void) | undefined
}

function loadInfo(kind: WhatsappChatTarget['kind'], id: string): Promise<WhatsappChatInfo> {
  if (kind === 'customer') return api.customers.whatsappChat({ id })
  return api.orders.whatsappChat({ kind, id })
}

function noteChat(kind: WhatsappChatTarget['kind'], id: string, template: WhatsappChatTemplate) {
  if (kind === 'customer') return api.customers.noteWhatsappChat({ id, template })
  return api.orders.noteWhatsappChat({ kind, id, template })
}

/**
 * Click to chat: pick a message (payment link, order confirmation, shipping update, abandoned
 * cart or blank), edit it, then open the staff member's own WhatsApp with it typed in. Needs no
 * WhatsApp connection; opening it is noted on the order or customer timeline.
 */
export default function WhatsappChatDialog({
  open,
  kind,
  id,
  onClose,
  onOpened,
}: WhatsappChatDialogProps) {
  // Hooks
  const copy = useCopy(whatsappChatContent)
  const [info, setInfo] = useState<WhatsappChatInfo | null>(null)
  const [failed, setFailed] = useState(false)
  // Null until the merchant picks or types: the most timely message, in its own words.
  const [template, setTemplate] = useState<WhatsappChatTemplate | null>(null)
  const [text, setText] = useState<string | null>(null)

  // Each opening loads the details afresh and starts from the template's own words.
  useEffect(() => {
    if (!open) return
    let live = true
    setInfo(null)
    setFailed(false)
    setTemplate(null)
    setText(null)
    loadInfo(kind, id)
      .then((loaded) => live && setInfo(loaded))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [open, kind, id])

  // Event handlers
  const handleTemplate = (next: unknown) => {
    if (!info || typeof next !== 'string') return
    const picked = chatTemplatesFor(info).find((t) => t === next)
    if (!picked) return
    setTemplate(picked)
    setText(copy.messages[picked](chatVars(picked, info)))
  }
  const handleOpen = () => {
    void noteChat(kind, id, current).then(
      () => onOpened?.(),
      () => undefined,
    )
    onClose()
  }

  // Render logic
  const current = template ?? (info ? defaultChatTemplate(info) : 'blank')
  const body = text ?? (info ? copy.messages[current](chatVars(current, info)) : '')
  const href = info ? whatsappChatUrl(info.phone, body) : null
  const templates = info ? chatTemplatesFor(info) : []

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.help}</DialogDescription>
        </DialogHeader>
        {failed ? (
          <p className="text-body text-destructive">{copy.failed}</p>
        ) : !info ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <span className="sr-only">{copy.loading}</span>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !href ? (
          <p className="text-body text-muted-foreground">{copy.noPhone}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{copy.to}</Label>
              <p className="truncate rounded-md border border-border bg-muted px-3 py-2 text-body text-foreground">
                {[info.customerName, info.phone].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label id="whatsapp-chat-template">{copy.templateLabel}</Label>
              <Select items={copy.templates} value={current} onValueChange={handleTemplate}>
                <SelectTrigger className="w-full" aria-labelledby="whatsapp-chat-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t} value={t}>
                      {copy.templates[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="whatsapp-chat-text">{copy.messageLabel}</Label>
              <Textarea
                id="whatsapp-chat-text"
                value={body}
                rows={6}
                maxLength={2000}
                placeholder={copy.messagePlaceholder}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
          {href ? (
            <Button
              render={<a href={href} target="_blank" rel="noreferrer" />}
              nativeButton={false}
              onClick={handleOpen}
            >
              <WhatsappLogo />
              {copy.open}
            </Button>
          ) : (
            <Button disabled>
              <WhatsappLogo />
              {copy.open}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
