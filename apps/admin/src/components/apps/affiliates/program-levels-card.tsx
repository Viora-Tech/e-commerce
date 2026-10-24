'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import SettingsCard from '@/components/settings/settings-card'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'

type ProgramLevelsCardProps = {
  levels: ProgramRules['levels']
  onChange: (levels: ProgramRules['levels']) => void
}

const MAX_LEVELS = 10

/** Order-value levels: a different percent once an order passes a value. */
export default function ProgramLevelsCard({ levels, onChange }: ProgramLevelsCardProps) {
  // Hooks
  const { program: copy, settings } = useCopy(affiliatesContent)

  // Event handlers
  const handleAdd = () =>
    onChange([...levels, { minOrderPaise: 2000_00, rule: { type: 'percent', bp: 1200 } }])
  const handleLevel = (i: number, patch: Partial<ProgramRules['levels'][number]>) =>
    onChange(levels.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  // Render logic
  return (
    <SettingsCard title={copy.levels} description={copy.levelsHelp}>
      {levels.length === 0 ? (
        <p className="text-caption text-muted-foreground">{copy.levelNone}</p>
      ) : null}
      {levels.map((l, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id; position is the identity
        <div key={`level-${i}`} className="grid gap-2 md:grid-cols-[10rem_6rem_auto]">
          <Input
            type="number"
            min={0}
            aria-label={copy.levelFrom}
            placeholder={copy.levelFrom}
            value={l.minOrderPaise / 100}
            onChange={(e) =>
              handleLevel(i, { minOrderPaise: Math.round((Number(e.target.value) || 0) * 100) })
            }
          />
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            aria-label={copy.levelRate}
            value={l.rule.type === 'percent' ? l.rule.bp / 100 : 0}
            onChange={(e) =>
              handleLevel(i, {
                rule: {
                  type: 'percent',
                  bp: Math.min(10_000, Math.round((Number(e.target.value) || 0) * 100)),
                },
              })
            }
          />
          <Button variant="ghost" onClick={() => onChange(levels.filter((_, j) => j !== i))}>
            {settings.remove}
          </Button>
        </div>
      ))}
      {levels.length < MAX_LEVELS ? (
        <div>
          <Button variant="outline" onClick={handleAdd}>
            {copy.addLevel}
          </Button>
        </div>
      ) : null}
    </SettingsCard>
  )
}
