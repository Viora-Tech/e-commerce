'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useState } from 'react'
import { gstProductTaxContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ChoiceField from './choice-field'
import { CELL } from './table-classes'

type Row = Awaited<ReturnType<typeof api.gstInvoicesProducts.list>>['items'][number]
type Change = { hsCode?: string | null; gstRatePercent?: number | null; taxable?: boolean }

type ProductsTaxRowProps = {
  row: Row
  rateOptions: { value: string; label: string }[]
  selected: boolean
  busy: boolean
  onSelect: (on: boolean) => void
  onChange: (change: Change) => void
}

const STORE = 'store'
const MIXED = 'mixed'
const HSN = /^\d{4,8}$/

/** One product on the Products tab: its Charge GST switch, rate and HSN, each saved on change. */
export default function ProductsTaxRow({
  row,
  rateOptions,
  selected,
  busy,
  onSelect,
  onChange,
}: ProductsTaxRowProps) {
  // Hooks
  const copy = useCopy(gstProductTaxContent)
  const [hsn, setHsn] = useState(row.hsCode ?? '')
  const [invalid, setInvalid] = useState(false)

  // Event handlers
  const handleHsnCommit = () => {
    const next = hsn.trim()
    if (next === (row.hsCode ?? '')) return
    if (next && !HSN.test(next)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onChange({ hsCode: next || null })
  }
  const handleRate = (value: string) => {
    if (value === MIXED || value === rateValue) return
    onChange({ gstRatePercent: value === STORE ? null : Number(value) })
  }

  // Render logic
  const rateValue = row.rateMixed
    ? MIXED
    : row.gstRatePercent === null
      ? STORE
      : String(row.gstRatePercent)
  const options = row.rateMixed
    ? [{ value: MIXED, label: copy.mixed }, ...rateOptions]
    : rateOptions

  return (
    <TableRow>
      <TableCell className={`${CELL} w-10`}>
        <Checkbox
          checked={selected}
          onCheckedChange={(on) => onSelect(on === true)}
          aria-label={copy.selectRow(row.title)}
        />
      </TableCell>
      <TableCell className={CELL}>
        <div className="flex min-w-0 flex-col">
          <Link
            href={routes.products.detail(row.id)}
            className="truncate font-medium hover:underline"
          >
            {row.title}
          </Link>
          <span className="text-caption text-muted-foreground">
            {copy.variants(row.variants)}
            {row.missingHsn > 0 && row.hsCode === null
              ? ` · ${copy.missingHsn(row.missingHsn)}`
              : ''}
          </span>
        </div>
      </TableCell>
      <TableCell className={CELL}>
        <div className="flex items-center gap-2">
          <Switch
            checked={row.charge === 'on'}
            disabled={busy}
            onCheckedChange={(on) => onChange({ taxable: on })}
            aria-label={copy.chargeLabel(row.title)}
          />
          {row.charge === 'mixed' ? (
            <span className="text-caption text-muted-foreground">{copy.mixed}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className={`${CELL} w-48`}>
        <ChoiceField
          id={`rate-${row.id}`}
          label={copy.columns.rate}
          hideLabel
          value={rateValue}
          options={options}
          onChange={handleRate}
        />
      </TableCell>
      <TableCell className={`${CELL} w-40`}>
        <Input
          value={hsn}
          inputMode="numeric"
          maxLength={8}
          placeholder={row.hsnMixed ? copy.mixed : copy.hsnPlaceholder}
          aria-label={copy.columns.hsn}
          aria-invalid={invalid || undefined}
          title={invalid ? copy.hsnInvalid : undefined}
          disabled={busy}
          onChange={(e) => setHsn(e.target.value.replace(/\D/g, ''))}
          onBlur={handleHsnCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleHsnCommit()
          }}
        />
      </TableCell>
    </TableRow>
  )
}
