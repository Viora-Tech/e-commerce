'use client'

import { Plus, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import type { TierDraft } from '@/lib/loyalty-program'
import ListSection from './list-section'

type PerksCardProps = {
  /** The tier picked in the tier strip; null when the store has none. */
  tier: TierDraft | null
  onChange: (perks: string[]) => void
}

/** Most perks a tier may list (the server's limit). */
const PERKS_MAX = 20

/** Perks: what members of the picked tier get, shown on their tier card; + Perk adds one. */
export default function PerksCard({ tier, onChange }: PerksCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  // Event handlers
  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    const perk = draft.trim()
    if (!tier || perk === '' || tier.perks.length >= PERKS_MAX) return
    if (!tier.perks.includes(perk)) onChange([...tier.perks, perk])
    setDraft('')
  }

  // Render logic
  const c = copy.perks
  const full = !tier || tier.perks.length >= PERKS_MAX

  return (
    <ListSection
      title={c.heading}
      subtitle={c.help}
      action={
        <Button size="sm" variant="outline" disabled={full} onClick={() => setAdding(true)}>
          <Plus />
          {c.add}
        </Button>
      }
    >
      {!tier ? (
        <li className="rounded-md border border-dashed border-line px-4 py-6 text-center text-body text-muted-foreground">
          {c.noTier}
        </li>
      ) : null}
      {tier && tier.perks.length === 0 && !adding ? (
        <li>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-4 py-6 text-body text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <Plus className="size-4" />
            {c.first}
          </button>
        </li>
      ) : null}
      {tier?.perks.map((perk, i) => (
        <li
          key={perk}
          className={
            i === 0
              ? 'flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 shadow-xs'
              : 'flex items-center justify-between gap-3 rounded-md px-3 py-2'
          }
        >
          <span className="text-body text-ink-strong">{perk}</span>
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
      {tier && adding ? (
        <li className="px-1 py-1">
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              size="lg"
              maxLength={200}
              autoFocus
              aria-label={c.add}
              placeholder={c.placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button type="submit" size="lg" disabled={draft.trim() === '' || full}>
              {c.addButton}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => {
                setAdding(false)
                setDraft('')
              }}
            >
              {c.done}
            </Button>
          </form>
        </li>
      ) : null}
    </ListSection>
  )
}
