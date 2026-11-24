'use client'

import type { RewardRow } from '@commerce/core'
import type { LoyaltySettings } from '@commerce/core/loyalty'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PillTabs from '@/components/layout/pill-tabs'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import type { TierDraft } from '@/lib/loyalty-program'
import MemberCardPreview from './member-card-preview'
import TierFields from './tier-fields'

type TiersCardProps = {
  tiers: TierDraft[]
  selected: TierDraft | null
  settings: LoyaltySettings
  rewards: RewardRow[]
  onSelect: (key: string) => void
  onAdd: () => void
  onChange: (key: string, patch: Partial<TierDraft>) => void
  onRemove: (key: string, wasSaved: boolean) => void
}

/** VIP tiers as tabs; the picked tier's fields on the left and its member card on the right. */
export default function TiersCard({
  tiers,
  selected,
  settings,
  rewards,
  onSelect,
  onAdd,
  onChange,
  onRemove,
}: TiersCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [removing, setRemoving] = useState<TierDraft | null>(null)

  // Event handlers
  const handleRemove = async () => {
    if (!removing) return
    if (!removing.id) {
      onRemove(removing.key, false)
      setRemoving(null)
      return
    }
    try {
      await api.loyalty.tiers.remove({ id: removing.id })
      toast.success(copy.tiers.removed)
      onRemove(removing.key, true)
      setRemoving(null)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
      throw err
    }
  }

  // Render logic
  const c = copy.tiers
  const index = selected ? tiers.findIndex((t) => t.key === selected.key) : -1
  const next = index >= 0 ? (tiers[index + 1] ?? null) : null

  return (
    <DataCard
      title={c.heading}
      subtitle={c.help}
      action={
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus />
          {c.add}
        </Button>
      }
    >
      {!selected ? (
        <EmptyState variant="dashed" body={c.empty} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="overflow-x-auto">
            <PillTabs
              label={c.stripLabel}
              value={selected.key}
              onChange={onSelect}
              tabs={tiers.map((t) => ({
                value: t.key,
                label: (
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: t.colors.background }}
                    />
                    {t.name.trim() || c.unnamed}
                  </span>
                ),
              }))}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <TierFields
              key={selected.key}
              tier={selected}
              settings={settings}
              rewards={rewards}
              onChange={(patch) => onChange(selected.key, patch)}
              onRemove={() => setRemoving(selected)}
            />
            <MemberCardPreview tier={selected} next={next} settings={settings} />
          </div>
        </div>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}
        title={c.removeTitle(removing?.name ?? '')}
        body={c.removeBody}
        confirmLabel={c.remove}
        tone="destructive"
        onConfirm={handleRemove}
      />
    </DataCard>
  )
}
