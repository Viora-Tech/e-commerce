'use client'

import { BadgePercent, Plus, Trash2, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useRef, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import ResourcePickDialog, {
  type PickResult,
  type PickTab,
} from '@/components/pickers/resource-pick-dialog'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type DiscountPick, MAX_DISCOUNTS } from './rollout-form-state'

type RolloutDiscountsChangeProps = {
  discounts: DiscountPick[]
  disabled: boolean
  onChange: (discounts: DiscountPick[]) => void
  onRemove: () => void
}

const PAGE = 30
const STATUSES = ['active', 'disabled'] as const

/** The discounts the rollout turns on or off, picked from the store's discounts. */
export default function RolloutDiscountsChange({
  discounts,
  disabled,
  onChange,
  onRemove,
}: RolloutDiscountsChangeProps) {
  // Hooks
  const {
    form: { discounts: copy, changes },
  } = useCopy(rolloutsContent)
  const [picking, setPicking] = useState(false)
  // Each discount's status as the picker loaded it, to suggest what the rollout sets.
  const seen = useRef(new Map<string, DiscountPick['status']>())

  // Event handlers
  const handleDone = (result: PickResult) => {
    const kept = discounts.filter((d) => result.ids.includes(d.id))
    const added = result.items
      .filter((i) => result.ids.includes(i.id) && !discounts.some((d) => d.id === i.id))
      // A discount that is off now is usually being switched on for the sale, and the reverse.
      .map((i) => ({
        id: i.id,
        title: i.title,
        status: seen.current.get(i.id) === 'active' ? ('disabled' as const) : ('active' as const),
      }))
    onChange([...kept, ...added].slice(0, MAX_DISCOUNTS))
    setPicking(false)
  }

  const handleStatus = (id: string, status: DiscountPick['status']) =>
    onChange(discounts.map((d) => (d.id === id ? { ...d, status } : d)))

  // Render logic
  const statusLabel = { active: copy.on, disabled: copy.off }
  const tabs: PickTab[] = [
    {
      key: 'discounts',
      label: copy.heading,
      search: copy.search,
      empty: copy.empty,
      load: async ({ page, search }) => {
        const r = await api.rollouts.listDiscounts({
          page,
          perPage: PAGE,
          search: search || undefined,
        })
        for (const d of r.items) seen.current.set(d.id, d.status)
        return {
          total: r.total,
          items: r.items.map((d) => ({
            id: d.id,
            title: d.title,
            subtitle: d.code ?? undefined,
            thumb: 'none' as const,
            meta: copy.currently[d.status],
          })),
        }
      },
    },
  ]

  return (
    <DataCard
      title={copy.heading}
      icon={<BadgePercent aria-hidden="true" className="size-4 text-muted-foreground" />}
      count={discounts.length}
      action={
        disabled ? null : (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 aria-hidden="true" />
            {changes.remove}
          </Button>
        )
      }
      footer={
        disabled ? null : (
          <Button variant="outline" onClick={() => setPicking(true)}>
            <Plus aria-hidden="true" />
            {copy.add}
          </Button>
        )
      }
      flush
    >
      {discounts.length === 0 ? (
        <p className="px-4 py-3 text-body text-muted-foreground md:px-6">{copy.empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {discounts.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 md:px-6">
              <span className="min-w-0 flex-1 basis-40 truncate text-body text-foreground">
                {d.title ?? copy.deleted}
              </span>
              <Select
                items={STATUSES.map((s) => ({ value: s, label: statusLabel[s] }))}
                value={d.status}
                disabled={disabled}
                onValueChange={(v) => handleStatus(d.id, v === 'disabled' ? 'disabled' : 'active')}
              >
                <SelectTrigger aria-label={copy.setTo(d.title ?? copy.deleted)} className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {disabled ? null : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={changes.remove}
                  onClick={() => onChange(discounts.filter((x) => x.id !== d.id))}
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {discounts.length >= MAX_DISCOUNTS ? (
        <p className="px-4 pb-3 text-caption text-muted-foreground md:px-6">
          {copy.max(MAX_DISCOUNTS)}
        </p>
      ) : null}
      <ResourcePickDialog
        open={picking}
        title={copy.pickTitle}
        tabs={tabs}
        selected={{ tab: 'discounts', ids: discounts.map((d) => d.id) }}
        onClose={() => setPicking(false)}
        onDone={handleDone}
      />
    </DataCard>
  )
}
