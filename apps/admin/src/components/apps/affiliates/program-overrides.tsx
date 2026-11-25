'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import EmptyState from '@/components/layout/empty-state'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'

type ProgramOverridesProps = {
  overrides: ProgramRules['overrides']
  onChange: (overrides: ProgramRules['overrides']) => void
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Special product commission: products or collections with their own percent. */
export default function ProgramOverrides({ overrides, onChange }: ProgramOverridesProps) {
  // Hooks
  const { settings: copy } = useCopy(affiliatesContent)

  // Event handlers
  const handleAdd = () =>
    onChange([
      ...overrides,
      { target: 'product', id: '', label: '', rule: { type: 'percent', bp: 1000 } },
    ])
  const handleRow = (i: number, patch: Partial<ProgramRules['overrides'][number]>) =>
    onChange(overrides.map((o, j) => (j === i ? { ...o, ...patch } : o)))

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">{copy.overridesHelp}</p>
      {overrides.length === 0 ? <EmptyState variant="inline" body={copy.overrideNone} /> : null}
      {overrides.map((o, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved
          key={`${i}-${o.target}`}
          className="grid gap-2 md:grid-cols-[8rem_1fr_1fr_6rem_auto]"
        >
          <NativeSelect
            value={o.target}
            aria-label={copy.type}
            onChange={(e) =>
              handleRow(i, { target: e.target.value === 'collection' ? 'collection' : 'product' })
            }
          >
            <NativeSelectOption value="product">{copy.overrideTarget.product}</NativeSelectOption>
            <NativeSelectOption value="collection">
              {copy.overrideTarget.collection}
            </NativeSelectOption>
          </NativeSelect>
          <Input
            placeholder={copy.overrideId}
            value={o.id}
            aria-invalid={o.id && !UUID.test(o.id) ? true : undefined}
            onChange={(e) => handleRow(i, { id: e.target.value.trim() })}
          />
          <Input
            placeholder={copy.overrideLabel}
            value={o.label}
            onChange={(e) => handleRow(i, { label: e.target.value })}
          />
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            aria-label={copy.rate}
            value={o.rule.type === 'percent' ? o.rule.bp / 100 : 0}
            onChange={(e) =>
              handleRow(i, {
                rule: { type: 'percent', bp: Math.round((Number(e.target.value) || 0) * 100) },
              })
            }
          />
          <Button variant="ghost" onClick={() => onChange(overrides.filter((_, j) => j !== i))}>
            {copy.remove}
          </Button>
        </div>
      ))}
      <div>
        <Button variant="outline" onClick={handleAdd}>
          {copy.addOverride}
        </Button>
      </div>
    </div>
  )
}
