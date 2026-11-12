'use client'

import { cn } from '@commerce/ui/lib/utils'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { type PriceCalculation, ratePercent } from './price-calculation'

type PriceBreakdownStripProps = {
  calc: PriceCalculation
  /** Shown on RapidShyp's estimated insurance. */
  estimateHint?: string | undefined
  className?: string | undefined
}

type Item = { key: string; label: string; value: string; title?: string | undefined }

const kg = (grams: number) => Math.round(grams / 10) / 100

/**
 * The picked courier's price in one line under its row (Figma 898:7790): Freight (charged
 * weight), the courier's other lines, Insurance, GST and You pay. The weight working (dead
 * against volumetric) and the insurance rate sit in each item's tooltip, so the line stays short.
 */
export default function PriceBreakdownStrip({
  calc,
  estimateHint,
  className,
}: PriceBreakdownStripProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Render logic
  const k = copy.calculation
  const d = copy.drawer
  const w = calc.weight
  const billed = w.courierGrams ?? w.billedGrams
  const weight = billed === null ? null : `${fmt.number(kg(billed))} kg`
  const working = [
    w.deadGrams === null ? null : `${k.dead}: ${fmt.number(kg(w.deadGrams))} kg`,
    w.volumetric
      ? `${k.volumetric(
          fmt.number(w.volumetric.lengthCm),
          fmt.number(w.volumetric.widthCm),
          fmt.number(w.volumetric.heightCm),
          String(w.volumetric.divisor),
        )} = ${fmt.number(kg(w.volumetric.grams))} kg`
      : null,
    w.basis ? k.billed(w.basis) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const items: Item[] = []
  let gstPaise = 0
  let gstSeen = false
  for (const [i, line] of calc.lines.entries()) {
    const value = fmt.money(line.paise)
    if (line.kind === 'charge' && line.charge === 'gst') {
      gstPaise += line.paise
      gstSeen = true
    } else if (line.kind === 'insuranceGst') {
      gstPaise += line.paise
      gstSeen = true
    } else if (line.kind === 'charge') {
      const freight = line.charge === 'freight'
      items.push({
        key: `c${i}`,
        label: freight && weight ? d.freightWeight(weight) : copy.courier.charge[line.charge],
        value,
        title: freight ? working : undefined,
      })
    } else if (line.kind === 'courierTotal') {
      items.push({
        key: `t${i}`,
        label: weight ? d.courierWeight(weight) : k.courierTotal,
        value,
        title: working || undefined,
      })
    } else if (line.kind === 'insuranceFee') {
      items.push({
        key: `i${i}`,
        label: d.insuranceShort,
        value,
        title:
          [
            line.rateBps === null
              ? k.insuranceMinimum
              : k.insuranceRate(
                  ratePercent(line.rateBps),
                  line.valuePaise === null ? '—' : fmt.money(line.valuePaise),
                ),
            line.gstIncluded ? k.inclGst : null,
            line.estimate ? estimateHint : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
      })
    } else {
      items.push({
        key: `r${i}`,
        label: line.kind === 'rounding' ? k.rounding : k.unitemised,
        value,
      })
    }
  }
  if (gstSeen) items.push({ key: 'gst', label: d.gstShort, value: fmt.money(gstPaise) })

  return (
    <div className={cn('flex flex-wrap items-center gap-x-8 gap-y-2 text-caption', className)}>
      <p className="font-medium tracking-wide text-muted-foreground uppercase">{d.breakdown}</p>
      <dl className="flex flex-wrap items-start gap-x-8 gap-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col gap-0.5" title={item.title}>
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="text-body font-medium text-ink-strong tabular-nums">{item.value}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{d.youPay}</dt>
          <dd className="text-body font-semibold text-ink-strong tabular-nums">
            {fmt.money(calc.totalPaise)}
          </dd>
        </div>
      </dl>
      {calc.insurance === 'unset' ? <p className="text-warning">{k.insuranceUnset}</p> : null}
    </div>
  )
}
