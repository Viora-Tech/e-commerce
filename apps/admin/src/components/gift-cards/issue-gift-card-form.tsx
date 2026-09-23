'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import MoneyInput from '@/components/fields/money-input'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import { giftCardIssueContent as copy, GIFT_CARD_PRESETS } from '@/data/gift-cards'
import { api } from '@/lib/api-client'
import CodeRevealDialog, { type IssuedCard } from './code-reveal-dialog'
import CustomerPicker, { type PickedCustomer } from './customer-picker'

type IssueGiftCardFormProps = {
  /** Today in the store's time zone (YYYY-MM-DD), the earliest expiry allowed. */
  today: string
}

const toPaise = (rupees: string): number | null => {
  const n = Math.round(Number(rupees) * 100)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Shopify's "Create gift card": value, code, expiry, customer or recipient, optional email. */
export default function IssueGiftCardForm({ today }: IssueGiftCardFormProps) {
  // Hooks
  const router = useRouter()
  const [value, setValue] = useState(String(GIFT_CARD_PRESETS[1]))
  const [code, setCode] = useState('')
  const [expires, setExpires] = useState(false)
  const [expiresOn, setExpiresOn] = useState('')
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [send, setSend] = useState(false)
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<IssuedCard | null>(null)

  // Event handlers
  const handleSave = async () => {
    const valuePaise = toPaise(value)
    if (!valuePaise) return
    setBusy(true)
    try {
      const r = await api.giftCards.issue({
        valuePaise,
        code: code.trim() || undefined,
        expiresOn: expires && expiresOn ? expiresOn : null,
        customerId: customer?.id ?? null,
        recipientEmail: recipientEmail.trim() || null,
        recipientName: recipientName.trim() || null,
        message: message.trim() || null,
        note: note.trim() || null,
        send,
      })
      setIssued(r)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const valuePaise = toPaise(value)
  const hasEmail = Boolean(customer?.email || recipientEmail.trim())
  const canSave = !busy && valuePaise !== null && (!expires || expiresOn >= today)

  return (
    <PageBody className="gap-6">
      <PageHeader
        title={copy.heading}
        breadcrumbs={[
          { label: copy.breadcrumb, href: '/products/gift-cards' },
          { label: copy.heading },
        ]}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/products/gift-cards')}>
              {copy.cancel}
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {busy ? copy.saving : copy.save}
            </Button>
          </>
        }
      />
      <PageColumns
        main={
          <Card className="gap-5 p-5">
            <p className="text-card-title text-foreground">{copy.details}</p>
            <Field>
              <FieldLabel htmlFor="gc-value">{copy.value}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {GIFT_CARD_PRESETS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={value === String(p) ? 'default' : 'outline'}
                    onClick={() => setValue(String(p))}
                  >
                    ₹{p.toLocaleString('en-IN')}
                  </Button>
                ))}
              </div>
              <MoneyInput id="gc-value" value={value} onChange={setValue} invalid={!valuePaise} />
              {valuePaise ? null : <FieldDescription>{copy.valueInvalid}</FieldDescription>}
            </Field>
            <Field>
              <FieldLabel htmlFor="gc-code">{copy.code}</FieldLabel>
              <Input
                id="gc-code"
                value={code}
                maxLength={24}
                placeholder={copy.codePlaceholder}
                className="font-mono uppercase"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoComplete="off"
              />
              <FieldDescription>{copy.codeHelp}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{copy.expiry}</FieldLabel>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="gc-expires"
                  checked={expires}
                  onCheckedChange={(v) => setExpires(Boolean(v))}
                />
                <Label htmlFor="gc-expires" className="text-body font-normal">
                  {copy.setExpiry}
                </Label>
              </div>
              {expires ? (
                <Input
                  type="date"
                  min={today}
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                  className="w-48"
                />
              ) : (
                <FieldDescription>{copy.noExpiry}</FieldDescription>
              )}
            </Field>
          </Card>
        }
        side={
          <>
            <Card className="gap-4 p-5">
              <p className="text-card-title text-foreground">{copy.customer}</p>
              <CustomerPicker value={customer} onChange={setCustomer} />
              <p className="text-caption text-muted-foreground">{copy.customerHelp}</p>
              <Field>
                <FieldLabel htmlFor="gc-recipient">{copy.recipient}</FieldLabel>
                <Input
                  id="gc-recipient"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="gc-recipient-name">{copy.recipientName}</FieldLabel>
                <Input
                  id="gc-recipient-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="gc-message">{copy.message}</FieldLabel>
                <Textarea
                  id="gc-message"
                  rows={3}
                  maxLength={500}
                  value={message}
                  placeholder={copy.messagePlaceholder}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="gc-send"
                  checked={send}
                  disabled={!hasEmail}
                  onCheckedChange={(v) => setSend(Boolean(v))}
                />
                <Label htmlFor="gc-send" className="flex flex-col items-start gap-0.5 font-normal">
                  <span className="text-body">{copy.send}</span>
                  <span className="text-caption text-muted-foreground">{copy.sendHelp}</span>
                </Label>
              </div>
            </Card>
            <Card className="gap-3 p-5">
              <Label htmlFor="gc-note" className="text-card-title">
                {copy.note}
              </Label>
              <Textarea
                id="gc-note"
                rows={3}
                value={note}
                placeholder={copy.notePlaceholder}
                onChange={(e) => setNote(e.target.value)}
              />
            </Card>
          </>
        }
      />
      <CodeRevealDialog
        issued={issued}
        onDone={(id) => router.push(`/products/gift-cards/${id}`)}
      />
    </PageBody>
  )
}
