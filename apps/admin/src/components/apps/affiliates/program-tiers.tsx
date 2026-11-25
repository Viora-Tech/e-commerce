'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'

type ProgramTiersProps = {
  tiers: ProgramRules['tiers']
  onChange: (tiers: ProgramRules['tiers']) => void
}

/** Affiliate tiers: a higher percent once an affiliate's approved sales pass a mark. */
export default function ProgramTiers({ tiers, onChange }: ProgramTiersProps) {
  // Hooks
  const { settings: copy } = useCopy(affiliatesContent)

  // Event handlers
  const handleAdd = () => onChange([...tiers, { name: '', minSalesPaise: 50_000_00, bp: 1500 }])
  const handleTier = (i: number, patch: Partial<ProgramRules['tiers'][number]>) =>
    onChange(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      {tiers.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved; position is the identity
        <div key={`tier-${i}`} className="grid gap-2 md:grid-cols-[1fr_10rem_6rem_auto]">
          <Input
            placeholder={copy.tierName}
            value={t.name}
            onChange={(e) => handleTier(i, { name: e.target.value })}
          />
          <Input
            type="number"
            min={0}
            aria-label={copy.tierFrom}
            placeholder={copy.tierFrom}
            value={t.minSalesPaise / 100}
            onChange={(e) =>
              handleTier(i, { minSalesPaise: Math.round((Number(e.target.value) || 0) * 100) })
            }
          />
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            aria-label={copy.tierRate}
            value={t.bp / 100}
            onChange={(e) => handleTier(i, { bp: Math.round((Number(e.target.value) || 0) * 100) })}
          />
          <Button variant="ghost" onClick={() => onChange(tiers.filter((_, j) => j !== i))}>
            {copy.remove}
          </Button>
        </div>
      ))}
      <div>
        <Button variant="outline" onClick={handleAdd}>
          {copy.addTier}
        </Button>
      </div>
    </div>
  )
}
