'use client'

import { Plus, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import type { TierDraft } from '@/lib/loyalty-program'

type PerksCardProps = {
  /** The tier picked in the tier strip; null when the store has none. */
  tier: TierDraft | null
  onChange: (perks: string[]) => void
}

/** Most perks a tier may list (the server's limit). */
const PERKS_MAX = 20

/** The picked tier's perks: a list members see on their tier card, with + Perk. */
export default function PerksCard({ tier, onChange }: PerksCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [draft, setDraft] = useState('')

  // Event handlers
  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    const perk = draft.trim()
    if (!tier || perk === '' || tier.perks.length >= PERKS_MAX) return
    if (tier.perks.includes(perk)) {
      setDraft('')
      return
    }
    onChange([...tier.perks, perk])
    setDraft('')
  }

  // Render logic
  const c = copy.perks

  return (
    <DataCard
      title={tier ? c.heading(tier.name.trim() || copy.tiers.unnamed) : c.headingNone}
      subtitle={c.help}
    >
      {!tier ? (
        <EmptyState variant="dashed" body={c.noTier} />
      ) : (
        <div className="flex flex-col gap-3">
          {tier.perks.length === 0 ? (
            <p className="text-body text-muted-foreground">{c.empty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {tier.perks.map((perk, i) => (
                <li key={perk} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-body text-foreground">{perk}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={c.remove}
                    onClick={() => onChange(tier.perks.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              size="lg"
              maxLength={200}
              aria-label={c.add}
              placeholder={c.placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              size="lg"
              disabled={draft.trim() === '' || tier.perks.length >= PERKS_MAX}
            >
              <Plus />
              {c.add}
            </Button>
          </form>
        </div>
      )}
    </DataCard>
  )
}
