'use client'

import { parseAmountMinor } from '@commerce/core/inventory'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { variantLabel } from '@/components/inventory/variant-picker'
import { chargesContent } from '@/data/purchasing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { PreviewLine } from './types'

type ChargeLinesFieldProps = {
  method: 'specific_lines' | 'manual'
  lines: PreviewLine[]
  selected: string[]
  /** Rupees per line as typed, for manual amounts. */
  manual: Record<string, string>
  /** The charge in paise, when its amount and rate are valid; manual amounts must reach it. */
  totalPaise: number | null
  onSelect: (ids: string[]) => void
  onManual: (manual: Record<string, string>) => void
}

/** Which lines a charge lands on (only some products) or how much each takes (amount per product). */
export default function ChargeLinesField({
  method,
  lines,
  selected,
  manual,
  totalPaise,
  onSelect,
  onManual,
}: ChargeLinesFieldProps) {
  // Hooks
  const { dialog: copy } = useCopy(chargesContent)
  const fmt = useFormat()

  // Event handlers
  const handleToggle = (lineId: string, on: boolean) =>
    onSelect(on ? [...selected, lineId] : selected.filter((id) => id !== lineId))

  // Render logic
  const assigned = Object.values(manual).reduce(
    (n, text) => n + (parseAmountMinor(text, 'INR') ?? 0),
    0,
  )
  const left = totalPaise === null ? null : totalPaise - assigned

  return (
    <Field>
      <FieldLabel>{copy.lines}</FieldLabel>
      <ul className="flex max-h-[14rem] flex-col overflow-y-auto rounded-lg border border-line">
        {lines.map((l) => (
          <li
            key={l.lineId}
            className="flex items-center gap-3 border-line border-b px-3 py-2 last:border-b-0"
          >
            {method === 'specific_lines' ? (
              <Label className="flex min-w-0 flex-1 items-center gap-2 text-body font-normal">
                <Checkbox
                  checked={selected.includes(l.lineId)}
                  onCheckedChange={(v) => handleToggle(l.lineId, Boolean(v))}
                />
                <span className="truncate">{variantLabel(l)}</span>
              </Label>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-body">{variantLabel(l)}</span>
                <Input
                  aria-label={variantLabel(l)}
                  value={manual[l.lineId] ?? ''}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-28 text-right tabular-nums"
                  onChange={(e) => onManual({ ...manual, [l.lineId]: e.target.value })}
                />
              </>
            )}
          </li>
        ))}
      </ul>
      {method === 'manual' && left !== null ? (
        <FieldDescription>
          {left === 0 ? copy.manualDone : copy.manualLeft(fmt.money(left))}
        </FieldDescription>
      ) : null}
    </Field>
  )
}
