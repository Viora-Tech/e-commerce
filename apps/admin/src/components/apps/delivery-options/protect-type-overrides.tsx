'use client'

import { PROTECT_CATEGORIES, type ProtectCategory } from '@commerce/core/delhivery-protect'
import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import type { ProtectDraft } from './protect-draft'

type ProtectTypeOverridesProps = {
  overrides: ProtectDraft['overrides']
  onChange: (overrides: ProtectDraft['overrides']) => void
}

/** Multi-category and Undetermined describe a parcel, never one product. */
const PICKABLE = PROTECT_CATEGORIES.filter((c) => c !== 'multi' && c !== 'undetermined')

/** Delhivery Protect's product-type overrides: "Glasspads" → Computers, Laptops and Accessories. */
export default function ProtectTypeOverrides({ overrides, onChange }: ProtectTypeOverridesProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)

  // Helpers
  const patch = (i: number, next: Partial<ProtectDraft['overrides'][number]>) =>
    onChange(overrides.map((o, j) => (j === i ? { ...o, ...next } : o)))

  // Event handlers
  const handleAdd = () => onChange([...overrides, { productType: '', category: 'computers' }])
  const handleRemove = (i: number) => onChange(overrides.filter((_, j) => j !== i))

  // Render logic
  const p = copy.protect
  const options = PICKABLE.map((c) => ({ value: c, label: p.categories[c] }))

  return (
    <div className="flex flex-col gap-2 border-t border-hairline pt-4">
      <div className="flex flex-col gap-1">
        <p className="text-body font-medium text-ink-strong">{p.overridesTitle}</p>
        <p className="text-caption text-muted-foreground">{p.overridesHelp}</p>
      </div>
      {overrides.length === 0 ? (
        <p className="text-caption text-muted-foreground">{p.overridesEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {overrides.map((o, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved; order is stable.
            <li key={i} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={p.productType}
                placeholder={p.productTypePlaceholder}
                value={o.productType}
                maxLength={120}
                onChange={(e) => patch(i, { productType: e.target.value })}
                className="w-48"
              />
              <span aria-hidden="true" className="text-muted-foreground">
                →
              </span>
              <div className="min-w-64 flex-1">
                <ChoiceField
                  id={`protect-type-${i}`}
                  label={p.category}
                  hideLabel
                  value={o.category}
                  options={options}
                  onChange={(v) => patch(i, { category: v as ProtectCategory })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={p.removeOverride}
                onClick={() => handleRemove(i)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" className="self-start" onClick={handleAdd}>
        <Plus aria-hidden="true" />
        {p.addOverride}
      </Button>
    </div>
  )
}
