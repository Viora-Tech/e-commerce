'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Switch } from '@commerce/ui/shadcn/switch'
import { SortableList } from '@commerce/ui/sortable'
import { type MethodId, methodNames, methodSortLabels } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import type { CheckoutMethodRow } from './types'

type MethodsListProps = {
  methods: CheckoutMethodRow[]
  /** False until a gateway is connected: online methods can't be turned on yet. */
  hasGateway: boolean
  disabled?: boolean
  onChange: (next: CheckoutMethodRow[]) => void
}

/**
 * "Shoppers can pay with": one row per way to pay, a switch to turn it on, a
 * grip to drag it. The order here is the order at checkout.
 */
export default function MethodsList({ methods, hasGateway, disabled, onChange }: MethodsListProps) {
  // Hooks
  const names = useCopy(methodNames)
  const sortLabels = useCopy(methodSortLabels)

  // Helpers
  const nameOf = (m: CheckoutMethodRow) => names[m.id as MethodId]?.name ?? m.id

  // Event handlers
  const handleToggle = (id: string, on: boolean) =>
    onChange(methods.map((m) => (m.id === id ? { ...m, on } : m)))

  return (
    <SortableList
      items={methods}
      onReorder={onChange}
      getTitle={nameOf}
      labels={sortLabels}
      className="-my-3.5 flex flex-col divide-y divide-hairline"
      renderItem={(m, { handle }) => {
        const locked = !hasGateway && m.id !== 'cod'
        const inputId = `method-${m.id}`
        return (
          <div className={cn('flex items-center gap-3 py-3.5', locked && 'opacity-70')}>
            {handle}
            <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer flex-col">
              <span className="text-body font-semibold text-ink-strong">{nameOf(m)}</span>
              <span className="text-caption text-muted-foreground">
                {names[m.id as MethodId]?.help}
              </span>
            </label>
            <Switch
              id={inputId}
              checked={m.on && !locked}
              disabled={disabled || locked}
              onCheckedChange={(on) => handleToggle(m.id, on)}
            />
          </div>
        )
      }}
    />
  )
}
