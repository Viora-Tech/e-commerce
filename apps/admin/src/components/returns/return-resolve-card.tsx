'use client'

import { parseRupees } from '@commerce/money'
import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import StoreCreditExpiryField from '@/components/customers/store-credit-expiry-field'
import OptionSelect from '@/components/landed-cost/option-select'
import DataCard from '@/components/layout/data-card'
import { returnDetailContent } from '@/data/returns'
import { useStoreCreditReturn } from '@/hooks/use-store-credit-return'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import ChoiceList from './choice-list'
import RestockButton from './restock-button'
import { type ReturnDetail, toRupees } from './return-types'

type Outcome = 'refund' | 'credit' | 'exchange' | 'reship' | 'close'

/** Back through the gateway, or recorded as paid back by hand. */
type Way = 'original' | 'manual'

type ReturnResolveCardProps = { detail: ReturnDetail; onChanged: () => void }

const copy = returnDetailContent.resolve

/** Ways to record money paid back by hand (store credit is its own outcome). */
const HAND_METHODS = ['upi', 'bank_transfer', 'cash', 'cheque', 'other'] as const
type HandMethod = (typeof HAND_METHODS)[number]

/** Payments with no gateway to send money back through: cash on delivery, by hand, imported. */
const NO_GATEWAY = new Set(['cod', 'manual', 'shopify'])

/** What the merchant usually picks first: their policy for returns, sending again for an RTO. */
function firstChoice(r: ReturnDetail): Outcome {
  if (r.kind === 'rto') return 'reship'
  // What the customer asked for on the return form comes first.
  if (r.preferredResolution === 'exchange') return 'exchange'
  if (r.preferredResolution === 'store_credit') return 'credit'
  if (r.refundablePaise <= 0) return 'exchange'
  return r.policy.refundMethod === 'store_credit' ? 'credit' : 'refund'
}

const isOutcome = (v: string): v is Outcome =>
  ['refund', 'credit', 'exchange', 'reship', 'close'].includes(v)

const isWay = (v: string): v is Way => v === 'original' || v === 'manual'

/** Settle a received return or RTO: refund, store credit, exchange, re-ship or close. */
export default function ReturnResolveCard({ detail: r, onChanged }: ReturnResolveCardProps) {
  // Hooks
  // An order paid with store credit: the credit's original last day is pre-filled.
  const creditBack = useStoreCreditReturn(r.orderId)
  const [outcome, setOutcome] = useState<Outcome>(() => firstChoice(r))
  const [amount, setAmount] = useState(() => toRupees(r.suggestedRefundPaise ?? 0))
  const [way, setWay] = useState<Way | null>(null)
  const [method, setMethod] = useState<HandMethod>('upi')
  const [expiresOn, setExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setExpiresOn(creditBack && creditBack.spentPaise > 0 ? creditBack.expiresOn : '')
  }, [creditBack])

  // Helpers
  const act = async (run: () => Promise<string>) => {
    setBusy(true)
    try {
      toast.success(await run())
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : returnDetailContent.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleOutcome = (v: string) => {
    if (isOutcome(v)) setOutcome(v)
  }

  const handleWay = (v: string) => {
    if (isWay(v)) setWay(v)
  }

  const handleConfirm = () =>
    act(async () => {
      // Confirm is disabled until the amount parses (`validAmount`), so null never gets here.
      const amountPaise = paise ?? 0
      if (outcome === 'refund' && byHand) {
        await api.returns.refund({ id: r.id, amountPaise, method })
        return copy.recorded(formatPaise(amountPaise), copy.handMethods[method])
      }
      if (outcome === 'refund') {
        await api.returns.refund({ id: r.id, amountPaise })
        return copy.refunded(formatPaise(amountPaise))
      }
      if (outcome === 'credit') {
        await api.returns.storeCredit({ id: r.id, amountPaise, expiresOn: expiresOn || null })
        return copy.credited(formatPaise(amountPaise))
      }
      if (outcome === 'exchange') {
        const ex = await api.returns.exchange({ id: r.id })
        return copy.exchanged(ex.draftNumber)
      }
      if (outcome === 'reship') {
        await api.returns.reship({ id: r.id })
        return copy.reshipped
      }
      await api.returns.close({ id: r.id })
      return copy.closed
    })

  // Render logic
  const rto = r.kind === 'rto'
  const paise = parseRupees(amount)
  const needsAmount = outcome === 'refund' || outcome === 'credit'
  const maxPaise = outcome === 'refund' ? r.refundablePaise : 20_000_000
  const validAmount = paise !== null && paise > 0 && paise <= maxPaise
  const suggestion = r.suggestedRefundPaise ?? 0
  const hasGateway = r.refundable.some((p) => !NO_GATEWAY.has(p.provider))
  const byHand = (way ?? (hasGateway ? 'original' : 'manual')) === 'manual'
  const ways = [
    ...(hasGateway ? [{ value: 'original', label: copy.original, hint: copy.originalHint }] : []),
    { value: 'manual', label: copy.byHand, hint: copy.byHandHint },
  ]
  const choices = [
    ...(r.refundablePaise > 0
      ? [{ value: 'refund', label: copy.refund, hint: copy.refundHint }]
      : []),
    ...(rto ? [{ value: 'reship', label: copy.reship, hint: copy.reshipHint }] : []),
    { value: 'credit', label: copy.credit, hint: copy.creditHint },
    ...(rto ? [] : [{ value: 'exchange', label: copy.exchange, hint: copy.exchangeHint }]),
    { value: 'close', label: copy.close, hint: copy.closeHint },
  ]
  const confirmLabel =
    outcome === 'refund'
      ? (byHand ? copy.confirmRecord : copy.confirmRefund)(formatPaise(validAmount ? paise : 0))
      : outcome === 'credit'
        ? copy.confirmCredit(formatPaise(validAmount ? paise : 0))
        : outcome === 'exchange'
          ? copy.confirmExchange
          : outcome === 'reship'
            ? copy.confirmReship
            : copy.confirmClose

  return (
    <DataCard title={copy.title} action={<RestockButton detail={r} onChanged={onChanged} />}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-muted-foreground">
          {copy.body} {rto ? null : copy.defaultMethod(copy.methods[r.policy.refundMethod])}
        </p>
        <ChoiceList name="resolve" choices={choices} value={outcome} onChange={handleOutcome} />
        {needsAmount ? (
          <Field>
            <FieldLabel htmlFor="resolve-amount">{copy.amount}</FieldLabel>
            <div className="flex max-w-sm gap-2">
              <Input
                id="resolve-amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setAmount(toRupees(suggestion))}
              >
                {copy.full}
              </Button>
            </div>
            <FieldDescription>
              {rto
                ? copy.rtoSuggestion(formatPaise(suggestion))
                : copy.suggestion(formatPaise(suggestion))}
              {outcome === 'refund' ? ` ${copy.available(formatPaise(r.refundablePaise))}` : ''}
            </FieldDescription>
          </Field>
        ) : null}
        {outcome === 'credit' ? (
          <div className="max-w-sm">
            <StoreCreditExpiryField
              id="resolve-credit-expires"
              value={expiresOn}
              onChange={setExpiresOn}
              originalDay={
                creditBack && creditBack.spentPaise > 0 ? creditBack.expiresOn : undefined
              }
            />
          </div>
        ) : null}
        {outcome === 'refund' ? (
          <FieldSet>
            <FieldLegend variant="label">{copy.how}</FieldLegend>
            <ChoiceList
              name="refund-way"
              choices={ways}
              value={byHand ? 'manual' : 'original'}
              onChange={handleWay}
            />
          </FieldSet>
        ) : null}
        {outcome === 'refund' && byHand ? (
          <Field className="max-w-sm">
            <FieldLabel htmlFor="refund-method">{copy.method}</FieldLabel>
            <OptionSelect
              id="refund-method"
              options={HAND_METHODS}
              labels={copy.handMethods}
              value={method}
              onChange={setMethod}
            />
          </Field>
        ) : null}
        <div>
          <Button
            loading={busy}
            size="lg"
            onClick={handleConfirm}
            disabled={
              busy || (needsAmount && !validAmount) || (outcome === 'credit' && !creditBack)
            }
          >
            <CheckIcon aria-hidden="true" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </DataCard>
  )
}
