'use client'

import type { OrderCancelReason, RefundOptions, RefundRoute } from '@commerce/core'
import { CancelCircle } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import DateField from '@/components/fields/date-field'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { orderDetailContent } from '@/data/order-detail'
import { orderCancelContent, refundRouteContent } from '@/data/order-edit'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { methodLabel, type OrderDetail } from './order-detail-types'

type CancelOrderDialogProps = {
  /** The order to cancel; null keeps the dialog closed. */
  order: OrderDetail | null
  onClose: () => void
  onDone: () => void
  /** For the dialog opened from an order row, so clicks inside it do not open the order. */
  stopPropagation?: boolean
}

/** Came from another platform (still imported, or taken over): its stock was counted there. */
const wasImported = (o: OrderDetail) => Boolean(o.importedFrom || o.importMeta?.takenOver)

/** Paid outside any gateway (cash on delivery, recorded payments): nothing to send money back through. */
const OFFLINE_PROVIDERS = new Set(['cod', 'manual'])

/**
 * The best refund the order allows: back to the original payment, else recorded by hand. Cash on
 * delivery has no gateway to refund into, so it starts on "recorded by hand", which is what the
 * merchant actually does.
 */
const defaultRoute = (options: RefundOptions): RefundRoute => {
  if (options.refundablePaise <= 0) return 'none'
  const offlineOnly = options.providers.every((p) => OFFLINE_PROVIDERS.has(p))
  return options.original && !offlineOnly ? 'original' : 'manual'
}

/** Today in the browser, `yyyy-mm-dd`: store credit cannot expire before it is issued. */
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * "Cancel order", laid out as Shopify's (owner, 2 Nov 2026): how the money goes back first (the
 * original payment, store credit with or without an expiry date, recorded by hand, or later),
 * then the reason, a staff note, and restock / email checkboxes. In the shared dialog shell.
 */
export default function CancelOrderDialog({
  order,
  onClose,
  onDone,
  stopPropagation = false,
}: CancelOrderDialogProps) {
  // Hooks
  const copy = useCopy(orderCancelContent)
  const routeCopy = useCopy(refundRouteContent)
  const detail = useCopy(orderDetailContent)
  const fmt = useFormat()
  const [reasonCode, setReasonCode] = useState<OrderCancelReason>('customer')
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(true)
  const [notify, setNotify] = useState(true)
  const [options, setOptions] = useState<RefundOptions | null>(null)
  const [route, setRoute] = useState<RefundRoute>('none')
  const [expires, setExpires] = useState(false)
  const [expiresOn, setExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!order) return
    let live = true
    setReasonCode('customer')
    setReason('')
    setRestock(!wasImported(order))
    setNotify(Boolean(order.email))
    setExpires(false)
    setExpiresOn('')
    setOptions(null)
    api.orders.refundOptions({ orderId: order.id }).then((o) => {
      if (!live) return
      setOptions(o)
      setRoute(defaultRoute(o))
    })
    return () => {
      live = false
    }
  }, [order])

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!order || !options) return
    const refund = options.refundablePaise > 0 ? route : 'none'
    setBusy(true)
    try {
      await api.orders.cancel({
        orderId: order.id,
        reasonCode,
        reason: reason.trim() || undefined,
        restock,
        notifyCustomer: notify,
        refund,
        ...(refund === 'store_credit' && expires && expiresOn
          ? { storeCreditExpiresOn: expiresOn }
          : {}),
      })
      toast.success(copy.done)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const imported = order ? wasImported(order) : false
  const reasonItems = Object.entries(copy.reasons).map(([value, label]) => ({ value, label }))
  const amount = options ? fmt.money(options.refundablePaise) : ''
  const via = (options?.providers ?? []).map((p) => methodLabel(p, detail)).join(', ')
  const offlineOnly = (options?.providers ?? []).every((p) => OFFLINE_PROVIDERS.has(p))
  const routes: { id: RefundRoute; label: string; hint: string }[] = options
    ? [
        ...(options.original && !offlineOnly
          ? [
              {
                id: 'original' as const,
                label: routeCopy.original(via),
                hint: routeCopy.amount(amount),
              },
            ]
          : []),
        { id: 'store_credit', label: routeCopy.storeCredit, hint: routeCopy.amount(amount) },
        // By hand only when the money cannot go back by itself (cash on delivery, old gateways).
        ...(!options.original || offlineOnly
          ? [{ id: 'manual' as const, label: routeCopy.manual, hint: routeCopy.manualHint }]
          : []),
        { id: 'none', label: copy.later, hint: copy.laterHint },
      ]
    : []
  const expiryItems = [
    { value: 'never', label: copy.noExpiry },
    { value: 'date', label: copy.addExpiry },
  ]

  return (
    <Dialog open={order !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}>
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>{order ? copy.title(order.number) : ''}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          {options && options.refundablePaise > 0 ? (
            <Field>
              <FieldLabel>{copy.refundHeading}</FieldLabel>
              <RadioGroup
                value={route}
                onValueChange={(v) => setRoute(v as RefundRoute)}
                className="flex flex-col gap-2"
              >
                {routes.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border px-3 py-2.5 has-data-checked:border-primary"
                  >
                    <label htmlFor={`cancel-refund-${r.id}`} className="flex items-start gap-3">
                      <RadioGroupItem
                        id={`cancel-refund-${r.id}`}
                        value={r.id}
                        className="mt-0.5"
                      />
                      <span className="flex flex-col gap-0.5 text-body">
                        <span className="text-ink-strong">{r.label}</span>
                        <span className="text-caption text-muted-foreground">{r.hint}</span>
                      </span>
                    </label>
                    {/* Shopify's store credit choice: no expiry, or a last day picked here. */}
                    {r.id === 'store_credit' && route === 'store_credit' ? (
                      <div className="mt-2 flex flex-col gap-2 pl-7 sm:flex-row sm:items-center">
                        <Select
                          items={expiryItems}
                          value={expires ? 'date' : 'never'}
                          onValueChange={(v) => setExpires(v === 'date')}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-full sm:w-44"
                            aria-label={copy.expiryLabel}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {expiryItems.map((i) => (
                              <SelectItem key={i.value} value={i.value}>
                                {i.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {expires ? (
                          <DateField
                            value={expiresOn}
                            onChange={setExpiresOn}
                            min={today()}
                            aria-label={copy.expiryLabel}
                            className="w-full sm:w-44"
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </RadioGroup>
              {!options.original ? (
                <FieldDescription>{routeCopy.unavailable}</FieldDescription>
              ) : null}
            </Field>
          ) : options ? (
            <p className="text-body text-muted-foreground">{copy.nothingToRefund}</p>
          ) : null}
          <Field>
            <FieldLabel htmlFor="cancel-reason-code">{copy.reason}</FieldLabel>
            <Select
              items={reasonItems}
              value={reasonCode}
              onValueChange={(v) => v && setReasonCode(v as OrderCancelReason)}
            >
              <SelectTrigger id="cancel-reason-code" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasonItems.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="cancel-reason">{copy.note}</FieldLabel>
            <Input
              id="cancel-reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={copy.reasonPlaceholder}
            />
            <FieldDescription>{copy.noteHint}</FieldDescription>
          </Field>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cancel-restock" className="flex items-center gap-2 font-normal">
              <Checkbox
                id="cancel-restock"
                checked={restock}
                onCheckedChange={(v) => setRestock(v === true)}
              />
              {copy.restock}
            </Label>
            {imported ? <FieldDescription>{copy.restockImported}</FieldDescription> : null}
            <Label htmlFor="cancel-notify" className="flex items-center gap-2 font-normal">
              <Checkbox
                id="cancel-notify"
                checked={notify}
                disabled={!order?.email}
                onCheckedChange={(v) => setNotify(v === true)}
              />
              {copy.notify}
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {copy.keep}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={busy || !options || (route === 'store_credit' && expires && !expiresOn)}
            >
              <CancelCircle aria-hidden="true" />
              {copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
