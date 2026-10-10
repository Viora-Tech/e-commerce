'use client'

import { type PurchaseCurrency, parseAmountMinor } from '@commerce/core/inventory'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import VariantPicker, { type VariantHit, variantLabel } from '@/components/inventory/variant-picker'
import KitThumb from '@/components/kit/kit-thumb'
import OptionSelect from '@/components/landed-cost/option-select'
import { documentReviewContent } from '@/data/purchase-documents'
import { useCopy } from '@/hooks/use-copy'
import { formatMinor } from '@/lib/money'
import {
  type DocumentReview,
  type LineTarget,
  type ReviewLine,
  type ReviewState,
  targetsOf,
} from './review-state'
import UnsureMark from './unsure-mark'

type ReviewLineItemProps = {
  review: DocumentReview
  line: ReviewLine
  shape: ReviewState['shape']
  currency: PurchaseCurrency
  /** The document's own order is a draft: any store product can be picked and added. */
  draft: boolean
  onChange: (patch: Partial<ReviewLine>) => void
}

type DutyKey = keyof ReviewLine['duties']
const DUTIES: DutyKey[] = ['assessable', 'bcd', 'sws', 'igst']

/** A picked product as a target: its order line when it is on the order, else a new line. */
function targetFromHit(review: DocumentReview, hit: VariantHit): LineTarget {
  const onOrder = review.lines.find((l) => l.variantId === hit.variantId)
  return {
    lineId: onOrder?.lineId ?? null,
    variantId: hit.variantId,
    label: variantLabel(hit),
    sku: hit.sku,
    imageUrl: hit.imageUrl,
  }
}

/** One line of the document: its match, its numbers, and how they differ from the order. */
export default function ReviewLineItem({
  review,
  line,
  shape,
  currency,
  draft,
  onChange,
}: ReviewLineItemProps) {
  // Hooks
  const { lines: copy } = useCopy(documentReviewContent)
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePick = (hit: VariantHit) => {
    onChange({ target: targetFromHit(review, hit), apply: true, method: 'none' })
    setPicking(false)
  }

  const handleSelect = (lineId: string) => {
    const target = targetsOf(review).find((t) => t.lineId === lineId) ?? null
    onChange({ target, apply: target !== null, method: 'none' })
    setPicking(false)
  }

  // Render logic
  const invoice = shape === 'supplier_invoice'
  const po = review.lines.find((l) => l.lineId === line.target?.lineId) ?? null
  const order = po ? review.orders.find((o) => o.id === po.purchaseOrderId) : null
  const price = parseAmountMinor(line.unitPrice, currency)
  const comparable = invoice && po !== null && order?.currency === currency
  const differs =
    comparable && (Number(line.quantity) !== po?.quantity || price !== po?.unitPriceMinor)
  const lineOptions = review.lines.map((l) => l.lineId)
  const lineLabels = Object.fromEntries(
    targetsOf(review).flatMap((t) => (t.lineId ? [[t.lineId, t.label]] : [])),
  )
  const matchedBy = line.target?.lineId
    ? copy.method[line.method] || line.target.sku || ''
    : copy.newOnOrder

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <Checkbox
          aria-label={line.description}
          checked={line.apply}
          onCheckedChange={(v) => onChange({ apply: Boolean(v) })}
          className="mt-0.5"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-body">
            {line.description}
            {line.unsure ? <UnsureMark /> : null}
          </span>
          <span className="text-caption text-muted-foreground">
            {[line.supplierSku, line.hsnCode ? `${copy.hsn} ${line.hsnCode}` : '']
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </div>
      <div className="ml-6 flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
        {line.target ? (
          <>
            <KitThumb src={line.target.imageUrl} alt="" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body">{line.target.label}</span>
              <span className="truncate text-caption text-muted-foreground">{matchedBy}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-caption text-warning">{copy.notMatched}</span>
        )}
        <Button variant="outline" size="sm" onClick={() => setPicking((p) => !p)}>
          {line.target ? copy.change : copy.pick}
        </Button>
      </div>
      {picking ? (
        <div className="ml-6">
          {draft ? (
            <VariantPicker placeholder={copy.pick} pickedIds={[]} onPick={handlePick} />
          ) : (
            <OptionSelect
              id={`line-${line.index}`}
              options={lineOptions}
              labels={lineLabels}
              value={line.target?.lineId ?? ''}
              onChange={handleSelect}
            />
          )}
        </div>
      ) : null}
      {invoice ? (
        <div className="ml-6 grid grid-cols-[5rem_7rem_7rem] gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">{copy.quantity}</span>
            <Input
              aria-label={copy.quantity}
              value={line.quantity}
              inputMode="numeric"
              className="text-right tabular-nums"
              onChange={(e) => onChange({ quantity: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">{copy.price(currency)}</span>
            <Input
              aria-label={copy.price(currency)}
              value={line.unitPrice}
              inputMode="decimal"
              className="text-right tabular-nums"
              onChange={(e) => onChange({ unitPrice: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">{copy.hsn}</span>
            <Input
              aria-label={copy.hsn}
              value={line.hsnCode}
              inputMode="numeric"
              maxLength={8}
              className="tabular-nums"
              onChange={(e) => onChange({ hsnCode: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div className="ml-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DUTIES.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <span className="text-caption text-muted-foreground">{copy[k]}</span>
              <Input
                aria-label={copy[k]}
                value={line.duties[k]}
                inputMode="decimal"
                className="text-right tabular-nums"
                onChange={(e) => onChange({ duties: { ...line.duties, [k]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      )}
      {comparable && po ? (
        <p
          className={cn(
            'ml-6 text-caption',
            differs ? 'font-medium text-warning' : 'text-muted-foreground',
          )}
        >
          {differs
            ? `${copy.poSays(po.quantity, formatMinor(po.unitPriceMinor, currency))}, ${copy.docSays(line.quantity, formatMinor(price ?? 0, currency))}`
            : copy.same}
        </p>
      ) : null}
    </li>
  )
}
