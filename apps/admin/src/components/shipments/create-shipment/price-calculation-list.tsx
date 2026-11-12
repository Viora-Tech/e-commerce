'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { type CalculationLine, type PriceCalculation, ratePercent } from './price-calculation'

type PriceCalculationListProps = {
  calc: PriceCalculation
  /** Shown on RapidShyp's estimated insurance lines. */
  estimateHint?: string | undefined
  className?: string | undefined
}

type Row = { key: string; label: ReactNode; value: string; note?: string | undefined }

const kg = (grams: number) => Math.round(grams / 10) / 100

/**
 * The picked courier's price worked out (owner, 12 Nov 2026): billed weight (dead against
 * volumetric), the courier's own lines or its single total, the insurance as rate × value + GST,
 * and the total, which is the row's price. Two small columns, numbers tabular.
 */
export default function PriceCalculationList({
  calc,
  estimateHint,
  className,
}: PriceCalculationListProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Helpers
  const weight = (grams: number) => `${fmt.number(kg(grams))} kg`
  const lineRow = (line: CalculationLine, i: number): Row => {
    const k = copy.calculation
    const key = `${line.kind}-${i}`
    const value = fmt.money(line.paise)
    switch (line.kind) {
      case 'charge':
        return { key, label: copy.courier.charge[line.charge], value }
      case 'courierTotal':
        return { key, label: k.courierTotal, value }
      case 'rounding':
        return { key, label: k.rounding, value }
      case 'unitemised':
        return { key, label: k.unitemised, value }
      case 'insuranceFee':
        return {
          key,
          label:
            line.rateBps === null
              ? k.insuranceMinimum
              : k.insuranceRate(
                  ratePercent(line.rateBps),
                  line.valuePaise === null ? '—' : fmt.money(line.valuePaise),
                ),
          value,
          note: [line.gstIncluded ? k.inclGst : null, line.estimate ? k.estimate : null]
            .filter(Boolean)
            .join(' · '),
        }
      case 'insuranceGst':
        return {
          key,
          label: k.insuranceGst(fmt.number(line.gstBps / 100)),
          value,
          note: line.estimate ? k.estimate : undefined,
        }
    }
  }

  // Render logic
  const k = copy.calculation
  const w = calc.weight
  const weightRows: Row[] = [
    ...(w.deadGrams === null ? [] : [{ key: 'dead', label: k.dead, value: weight(w.deadGrams) }]),
    ...(w.volumetric
      ? [
          {
            key: 'vol',
            label: k.volumetric(
              fmt.number(w.volumetric.lengthCm),
              fmt.number(w.volumetric.widthCm),
              fmt.number(w.volumetric.heightCm),
              String(w.volumetric.divisor),
            ),
            value: weight(w.volumetric.grams),
          },
        ]
      : w.deadGrams === null
        ? []
        : [{ key: 'nobox', label: k.noBox, value: '—' }]),
    ...(w.billedGrams === null
      ? []
      : [
          {
            key: 'billed',
            label: w.basis ? k.billed(w.basis) : k.charged,
            value: weight(w.billedGrams),
          },
        ]),
    ...(w.courierGrams === null
      ? []
      : [
          {
            key: 'courier',
            label: k.courierWeight,
            value: weight(w.courierGrams),
            note: k.courierWeightNote,
          },
        ]),
  ]
  const charges = calc.lines.filter((l) => l.kind !== 'insuranceFee' && l.kind !== 'insuranceGst')
  const insurance = calc.lines.filter((l) => l.kind === 'insuranceFee' || l.kind === 'insuranceGst')
  const totalOnly = charges.length === 1 && charges[0]?.kind === 'courierTotal'

  return (
    <div className={cn('grid gap-x-10 gap-y-3 text-caption md:grid-cols-2', className)}>
      <p className="font-medium uppercase tracking-wide text-muted-foreground md:col-span-2">
        {k.heading}
      </p>
      {weightRows.length > 0 ? <Group title={k.weight} rows={weightRows} /> : null}
      <div className="flex flex-col gap-3">
        <Group
          title={k.charges}
          rows={charges.map(lineRow)}
          foot={totalOnly ? k.totalOnly : undefined}
        />
        {insurance.length > 0 ? (
          <Group
            title={k.insurance}
            rows={insurance.map(lineRow)}
            hint={
              insurance.some((l) => l.kind === 'insuranceFee' && l.estimate)
                ? estimateHint
                : undefined
            }
          />
        ) : calc.insurance === 'unset' ? (
          <p className="text-warning">{k.insuranceUnset}</p>
        ) : null}
        <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-1.5 text-body font-semibold text-ink-strong">
          <span>{k.total}</span>
          <span className="tabular-nums">{fmt.money(calc.totalPaise)}</span>
        </div>
      </div>
    </div>
  )
}

function Group({
  title,
  rows,
  foot,
  hint,
}: {
  title: string
  rows: Row[]
  foot?: string | undefined
  hint?: string | undefined
}) {
  return (
    <div className="flex flex-col gap-1" title={hint}>
      <p className="font-medium text-ink-strong">{title}</p>
      <dl className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">
              {r.label}
              {r.note ? <span className="ml-1.5 text-muted-foreground/80">({r.note})</span> : null}
            </dt>
            <dd className="shrink-0 tabular-nums text-ink-strong">{r.value}</dd>
          </div>
        ))}
      </dl>
      {foot ? <p className="text-muted-foreground">{foot}</p> : null}
    </div>
  )
}
