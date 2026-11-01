'use client'

import { Send } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import PillTabs from '@/components/layout/pill-tabs'
import { sendMessageContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { whatsappChatUrl } from '@/lib/customer-contact'
import ReminderChannelPicker, { type SendChannel } from './reminder-channel-picker'

/** Order messages, plus the abandoned checkout reminder (whose id is the cart's). */
type Template = Parameters<typeof api.orders.previewMessage>[0]['template'] | 'checkout_recovery'
type Preview = Awaited<ReturnType<typeof api.orders.previewMessage>>
type Tab = 'email' | 'whatsapp'

/** What the merchant changed; empty fields fall back to the template's own words. */
export type CustomMessage = { subject?: string | undefined; message?: string | undefined }

type SendMessageDialogProps = {
  /** The order (or draft, or the cart for checkout_recovery) the message is about; null closes it. */
  orderId: string | null
  template: Template
  /**
   * Sends the message for real with the edits; the dialog closes once it resolves. `channel` is
   * set only when the merchant could choose (`chooseChannel`, the store can email and WhatsApp).
   */
  onSend: (custom: CustomMessage | undefined, channel?: SendChannel) => Promise<void>
  /**
   * Payment reminders: "Send by" Email / WhatsApp / Both, or "Open in WhatsApp" (the merchant's
   * own chat) when the store has no WhatsApp channel; `onChatOpened` records that on the order.
   */
  chooseChannel?: { onChatOpened: () => void } | undefined
  onClose: () => void
  /** For a dialog opened from a clickable table row: clicks inside must not open the row. */
  stopPropagation?: boolean
}

/** Wait this long after the last keystroke before re-rendering the preview. */
const PREVIEW_DEBOUNCE_MS = 450

/** The filled message: a cart's reminder or an order's message, rendered but not sent. */
function loadPreview(
  id: string,
  template: Template,
  custom: CustomMessage | undefined,
): Promise<Preview> {
  if (template === 'checkout_recovery') return api.orders.previewRecovery({ cartId: id, custom })
  return api.orders.previewMessage({ orderId: id, template, custom })
}

/** The edits worth sending: blank fields are left out so the template's words stay. */
function customOf(subject: string, message: string): CustomMessage | undefined {
  const s = subject.trim()
  const m = message.trim()
  if (!s && !m) return undefined
  return { ...(s ? { subject: s } : {}), ...(m ? { message: m } : {}) }
}

/**
 * Shopify's "Send invoice" step: the merchant sees who it goes to, can change the subject
 * and add a note, and sees the email exactly as the customer will (filled with this order,
 * updated as they type), then sends or backs out.
 */
export default function SendMessageDialog({
  orderId,
  template,
  onSend,
  onClose,
  chooseChannel,
  stopPropagation = false,
}: SendMessageDialogProps) {
  // Hooks
  const copy = useCopy(sendMessageContent)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('email')
  const [sending, setSending] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState<SendChannel>('both')

  // Each opening (orderId goes null → id) starts from the template's own words.
  useEffect(() => {
    if (!orderId) return
    setPreview(null)
    setFailed(false)
    setTab('email')
    setChannel('both')
    setSubject('')
    setMessage('')
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    let live = true
    const custom = customOf(subject, message)
    setRefreshing(true)
    const timer = setTimeout(
      () => {
        loadPreview(orderId, template, custom)
          .then((p) => {
            if (!live) return
            setPreview(p)
            setSubject((s) => s || p.defaultSubject)
          })
          .catch(() => live && setFailed(true))
          .finally(() => live && setRefreshing(false))
      },
      subject || message ? PREVIEW_DEBOUNCE_MS : 0,
    )
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [orderId, template, subject, message])

  // Event handlers
  const handleChannel = (next: SendChannel) => {
    setChannel(next)
    if (next !== 'both') setTab(next)
  }
  const handleSend = async () => {
    setSending(true)
    try {
      await onSend(
        customOf(subject === preview?.defaultSubject ? '' : subject, message),
        choosing ? channel : undefined,
      )
      onClose()
    } finally {
      setSending(false)
    }
  }

  // Render logic
  const t = copy.templates[template]
  const canEmail = Boolean(preview?.to.email)
  const canWhatsapp = Boolean(preview?.whatsapp && preview.to.phone)
  const choosing = Boolean(chooseChannel) && canEmail && canWhatsapp
  const sendsEmail = !choosing || channel !== 'whatsapp'
  const sendsWhatsapp = !choosing || channel !== 'email'
  const to = [
    sendsEmail ? preview?.to.email : undefined,
    sendsWhatsapp && preview?.whatsapp ? preview.to.phone : undefined,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Dialog open={orderId !== null} onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent
        size="wide"
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{copy.help}</DialogDescription>
        </DialogHeader>
        {failed ? (
          <p className="text-body text-destructive">{copy.failed}</p>
        ) : !preview ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <span className="sr-only">{copy.loading}</span>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-[18rem] w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {preview.on ? null : (
              <p className="rounded-lg border border-warning/35 bg-warning-soft px-3 py-2 text-body text-foreground">
                {copy.off}
              </p>
            )}
            {chooseChannel ? (
              <ReminderChannelPicker
                channel={channel}
                onChange={handleChannel}
                canEmail={canEmail}
                canWhatsapp={canWhatsapp}
                chatHref={
                  preview.chatText ? whatsappChatUrl(preview.to.phone, preview.chatText) : null
                }
                onChatOpened={chooseChannel.onChatOpened}
              />
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label>{copy.to}</Label>
              <p className="truncate rounded-md border border-border bg-muted px-3 py-2 text-body text-foreground">
                {to || copy.noContact}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="send-message-subject">{copy.subject}</Label>
              <Input
                id="send-message-subject"
                value={subject}
                maxLength={200}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="send-message-note">{copy.message}</Label>
              <Textarea
                id="send-message-note"
                value={message}
                maxLength={2000}
                rows={3}
                placeholder={copy.messagePlaceholder}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body font-medium text-foreground">{copy.previewHeading}</span>
                {refreshing ? <Spinner className="size-4 text-muted-foreground" /> : null}
              </div>
              {preview.whatsapp ? (
                <PillTabs
                  variant="underline"
                  tabs={[
                    { value: 'email' as const, label: copy.email },
                    { value: 'whatsapp' as const, label: copy.whatsapp },
                  ]}
                  value={tab}
                  onChange={setTab}
                  className="border-b border-border"
                />
              ) : null}
              {tab === 'email' ? (
                <iframe
                  title={copy.frameTitle}
                  srcDoc={preview.html}
                  sandbox=""
                  className={cn(
                    'h-[50dvh] min-h-[18rem] w-full rounded-lg border border-border transition-opacity',
                    refreshing && 'opacity-60',
                  )}
                />
              ) : (
                <div className="rounded-lg border border-border bg-muted p-4">
                  <p className="max-w-[28rem] whitespace-pre-wrap rounded-lg bg-card p-3 text-body text-foreground shadow-sm">
                    {preview.whatsapp}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSend} disabled={sending || !preview || !to}>
            {sending ? <Spinner /> : <Send aria-hidden="true" />}
            {t.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
