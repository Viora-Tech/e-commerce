'use client'

import type { RouteRule } from '@commerce/core/delivery-options'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SectionHead from '@/components/layout/section-head'
import SortableStack from '@/components/layout/sortable-stack'
import { reorderLabels } from '@/data/common'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import RuleDialog from './rule-dialog'
import RuleRow from './rule-row'
import { useDeliveryOverview } from './use-delivery-overview'

/**
 * Apps → Delivery options → Product rules (Figma 929:12840): the rules in the order they win,
 * dragged to reorder (saved at once), "Add rule" in the head, Edit on each row.
 */
export default function DeliveryRulesPage() {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)
  const sortLabels = useCopy(reorderLabels)
  const { overview, reload } = useDeliveryOverview()
  const [rules, setRules] = useState<RouteRule[]>([])
  const [editing, setEditing] = useState<RouteRule | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (overview) setRules(overview.rules)
  }, [overview])

  // Event handlers
  const handleAdd = () => {
    setEditing(null)
    setOpen(true)
  }
  const handleEdit = (rule: RouteRule) => {
    setEditing(rule)
    setOpen(true)
  }
  const handleReorder = async (next: RouteRule[]) => {
    const before = rules
    setRules(next)
    try {
      await api.deliveryOptions.reorderRules({ ids: next.map((r) => r.id) })
    } catch (err) {
      setRules(before)
      toast.error(err instanceof Error ? err.message : copy.failed)
    }
  }

  // Early returns
  if (!overview) return null

  // Render logic
  const names = new Map(overview.options.map((o) => [o.id, o.name]))

  return (
    <div className="flex flex-col gap-5">
      <SectionHead
        title={pages.pages.rules.title}
        intro={pages.pages.rules.intro}
        action={<Button onClick={handleAdd}>{copy.rules.add}</Button>}
      />
      <section className="rounded-xl border border-panel-border bg-card">
        {rules.length === 0 ? (
          <p className="px-4 py-3 text-body text-muted-foreground">{copy.rules.empty}</p>
        ) : (
          <SortableStack
            items={rules}
            onReorder={handleReorder}
            getTitle={(r) => r.name}
            labels={sortLabels}
            className="flex flex-col divide-y divide-hairline"
            itemClassName="first:rounded-t-xl last:rounded-b-xl"
            renderItem={(r, { handle, isDragging }) => (
              <RuleRow
                rule={r}
                place={rules.indexOf(r) + 1}
                optionNames={names}
                handle={handle}
                isDragging={isDragging}
                onEdit={() => handleEdit(r)}
              />
            )}
          />
        )}
      </section>
      <RuleDialog
        open={open}
        rule={editing}
        options={overview.options}
        onOpenChange={setOpen}
        onSaved={reload}
      />
    </div>
  )
}
