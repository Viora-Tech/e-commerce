'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import SettingsCard from '@/components/settings/settings-card'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'

type ProgramExcludesCardProps = {
  excludes: ProgramRules['excludes']
  onChange: (excludes: ProgramRules['excludes']) => void
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Products and collections that earn no commission at all. */
export default function ProgramExcludesCard({ excludes, onChange }: ProgramExcludesCardProps) {
  // Hooks
  const { program: copy, settings } = useCopy(affiliatesContent)

  // Event handlers
  const handleAdd = () => onChange([...excludes, { target: 'product', id: '', label: '' }])
  const handleRow = (i: number, patch: Partial<ProgramRules['excludes'][number]>) =>
    onChange(excludes.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  // Render logic
  return (
    <SettingsCard title={copy.excludes} description={copy.excludesHelp}>
      {excludes.length === 0 ? (
        <p className="text-caption text-muted-foreground">{copy.excludeNone}</p>
      ) : null}
      {excludes.map((x, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved
          key={`${i}-${x.target}`}
          className="grid gap-2 md:grid-cols-[8rem_1fr_1fr_auto]"
        >
          <NativeSelect
            value={x.target}
            aria-label={settings.type}
            onChange={(e) =>
              handleRow(i, { target: e.target.value === 'collection' ? 'collection' : 'product' })
            }
          >
            <NativeSelectOption value="product">
              {settings.overrideTarget.product}
            </NativeSelectOption>
            <NativeSelectOption value="collection">
              {settings.overrideTarget.collection}
            </NativeSelectOption>
          </NativeSelect>
          <Input
            placeholder={settings.overrideId}
            value={x.id}
            aria-invalid={x.id && !UUID.test(x.id) ? true : undefined}
            onChange={(e) => handleRow(i, { id: e.target.value.trim() })}
          />
          <Input
            placeholder={settings.overrideLabel}
            value={x.label}
            onChange={(e) => handleRow(i, { label: e.target.value })}
          />
          <Button variant="ghost" onClick={() => onChange(excludes.filter((_, j) => j !== i))}>
            {settings.remove}
          </Button>
        </div>
      ))}
      <div>
        <Button variant="outline" onClick={handleAdd}>
          {copy.addExclude}
        </Button>
      </div>
    </SettingsCard>
  )
}
