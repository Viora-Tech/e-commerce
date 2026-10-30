'use client'

import type { BoxPreset, PackageKind } from '@commerce/core'
import { parseRupees } from '@commerce/money'
import { Package, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { shippingSettingsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'

type BoxPresetsFieldsProps = {
  value: BoxPreset[] | undefined
  onChange: (next: BoxPreset[]) => void
}

const blankBox = (): BoxPreset => ({
  id: crypto.randomUUID(),
  name: '',
  kind: 'box',
  lengthCm: 20,
  widthCm: 15,
  heightCm: 10,
  weightGrams: 200,
  isDefault: false,
  costPaise: null,
})

/** The package types in the order the menu lists them (`PACKAGE_KINDS` in core). */
const KINDS: readonly PackageKind[] = ['box', 'envelope', 'soft_package']

/** An envelope is flat: its height is kept at 1 cm and not asked for. */
const FLAT_CM = 1

/** Typed rupees as paise; blank (or not a number) is "no cost set". */
const costOf = (text: string): number | null => (text.trim() ? parseRupees(text) : null)

/** Settings → Shipping's named boxes, stored in the shipping settings JSON. The booking flow
 *  pre-fills from whichever one is the default. */
export default function BoxPresetsFields({ value, onChange }: BoxPresetsFieldsProps) {
  // Hooks
  const { boxPresets: copy } = useCopy(shippingSettingsContent)

  // Event handlers
  const handleAdd = () => {
    const boxes = value ?? []
    onChange([...boxes, { ...blankBox(), isDefault: boxes.length === 0 }])
  }

  const handleRemove = (id: string) => {
    const boxes = (value ?? []).filter((b) => b.id !== id)
    if (boxes.length > 0 && !boxes.some((b) => b.isDefault)) {
      const first = boxes[0]
      if (first) first.isDefault = true
    }
    onChange(boxes)
  }

  const handlePatch = (id: string, patch: Partial<BoxPreset>) => {
    onChange((value ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  const handleKind = (id: string, kind: PackageKind) => {
    handlePatch(id, kind === 'envelope' ? { kind, heightCm: FLAT_CM } : { kind })
  }

  const handleMakeDefault = (id: string) => {
    onChange((value ?? []).map((b) => ({ ...b, isDefault: b.id === id })))
  }

  // Render logic
  const boxes = value ?? []

  return (
    <DataCard title={copy.heading}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-muted-foreground">{copy.intro}</p>
        <p className="text-caption text-muted-foreground">{copy.costHelp}</p>
        {boxes.length === 0 ? (
          <EmptyState icon={Package} heading={copy.empty} />
        ) : (
          <div className="flex flex-col gap-3">
            {boxes.map((box) => (
              <div
                key={box.id}
                className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1.5fr_1.2fr_1fr_1fr_1fr_1fr_1fr_auto] sm:items-end"
              >
                <Field>
                  <FieldLabel htmlFor={`box-name-${box.id}`}>{copy.name}</FieldLabel>
                  <Input
                    id={`box-name-${box.id}`}
                    placeholder={copy.namePlaceholder}
                    value={box.name}
                    onChange={(e) => handlePatch(box.id, { name: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`box-kind-${box.id}`}>{copy.kind}</FieldLabel>
                  <NativeSelect
                    id={`box-kind-${box.id}`}
                    className="w-full"
                    value={box.kind}
                    onChange={(e) => handleKind(box.id, e.target.value as PackageKind)}
                  >
                    {KINDS.map((k) => (
                      <NativeSelectOption key={k} value={k}>
                        {copy.kinds[k]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`box-length-${box.id}`}>{copy.length}</FieldLabel>
                  <Input
                    id={`box-length-${box.id}`}
                    type="number"
                    value={box.lengthCm}
                    onChange={(e) => handlePatch(box.id, { lengthCm: Number(e.target.value) })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`box-width-${box.id}`}>{copy.width}</FieldLabel>
                  <Input
                    id={`box-width-${box.id}`}
                    type="number"
                    value={box.widthCm}
                    onChange={(e) => handlePatch(box.id, { widthCm: Number(e.target.value) })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`box-height-${box.id}`}>{copy.height}</FieldLabel>
                  <Input
                    id={`box-height-${box.id}`}
                    type="number"
                    value={box.heightCm}
                    disabled={box.kind === 'envelope'}
                    onChange={(e) => handlePatch(box.id, { heightCm: Number(e.target.value) })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`box-weight-${box.id}`}>{copy.weight}</FieldLabel>
                  <Input
                    id={`box-weight-${box.id}`}
                    type="number"
                    value={box.weightGrams}
                    onChange={(e) => handlePatch(box.id, { weightGrams: Number(e.target.value) })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`box-cost-${box.id}`}>{copy.cost}</FieldLabel>
                  <Input
                    id={`box-cost-${box.id}`}
                    inputMode="decimal"
                    defaultValue={box.costPaise == null ? '' : String(box.costPaise / 100)}
                    onBlur={(e) => handlePatch(box.id, { costPaise: costOf(e.target.value) })}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  {box.isDefault ? (
                    <span className="rounded-full bg-primary-soft px-2 py-1 text-caption text-primary">
                      {copy.default}
                    </span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleMakeDefault(box.id)}>
                      {copy.makeDefault}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={copy.remove}
                    onClick={() => handleRemove(box.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="w-fit self-end" onClick={handleAdd}>
          <Plus aria-hidden="true" />
          {copy.add}
        </Button>
      </div>
    </DataCard>
  )
}
