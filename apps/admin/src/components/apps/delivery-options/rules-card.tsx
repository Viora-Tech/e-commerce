'use client'

import type { DeliveryOption, RouteRule } from '@commerce/core/delivery-options'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { ruleSummary } from './format'
import RuleDialog from './rule-dialog'

type RulesCardProps = {
  rules: RouteRule[]
  options: DeliveryOption[]
  onChanged: () => void
}

/** Product and collection route rules, highest first; add or edit opens a dialog. */
export default function RulesCard({ rules, options, onChanged }: RulesCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const [editing, setEditing] = useState<RouteRule | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Helpers
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await work()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleAdd = () => {
    setEditing(null)
    setOpen(true)
  }
  const handleEdit = (rule: RouteRule) => {
    setEditing(rule)
    setOpen(true)
  }
  const handleMove = (index: number, by: -1 | 1) => {
    const ids = rules.map((r) => r.id)
    const [moved] = ids.splice(index, 1)
    if (!moved) return
    ids.splice(index + by, 0, moved)
    return run(() => api.deliveryOptions.reorderRules({ ids }))
  }
  const handleDelete = (id: string) => run(() => api.deliveryOptions.deleteRule({ id }))

  // Render logic
  const names = new Map(options.map((o) => [o.id, o.name]))

  return (
    <SettingsCard
      title={copy.rules.title}
      description={copy.rules.description}
      footer={
        <Button variant="outline" onClick={handleAdd}>
          <Plus aria-hidden />
          {copy.rules.add}
        </Button>
      }
    >
      {rules.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.rules.empty}</p>
      ) : (
        <ol className="flex flex-col">
          {rules.map((r, i) => (
            <li
              key={r.id}
              className="flex items-center gap-2 border-t border-hairline py-2.5 first:border-t-0"
            >
              <span className="w-6 shrink-0 text-caption text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <span
                className={`min-w-0 flex-1 text-body ${r.enabled ? 'text-ink-strong' : 'text-muted-foreground line-through'}`}
              >
                {ruleSummary(r, names, copy)}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={copy.moveUp}
                disabled={busy || i === 0}
                onClick={() => handleMove(i, -1)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={copy.moveDown}
                disabled={busy || i === rules.length - 1}
                onClick={() => handleMove(i, 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={copy.edit}
                onClick={() => handleEdit(r)}
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={copy.delete}
                disabled={busy}
                onClick={() => handleDelete(r.id)}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <RuleDialog
        open={open}
        rule={editing}
        options={options}
        onOpenChange={setOpen}
        onSaved={onChanged}
      />
    </SettingsCard>
  )
}
