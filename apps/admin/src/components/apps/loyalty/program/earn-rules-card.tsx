'use client'

import type { EarnRuleRow } from '@commerce/core'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { loyaltyRulesContent } from '@/data/loyalty-rules'
import { useCopy } from '@/hooks/use-copy'
import { newRuleForm, type RuleChoice, type RuleForm, ruleFormOf } from '@/lib/loyalty-rules'
import AddRuleDialog from './add-rule-dialog'
import RuleEditorDialog from './rule-editor-dialog'
import RuleIcon from './rule-icon'

type EarnRulesCardProps = {
  rules: EarnRuleRow[]
  onRules: (rules: EarnRuleRow[]) => void
}

/** Ways to earn besides orders: each row opens its editor; + Rule opens the catalog. */
export default function EarnRulesCard({ rules, onRules }: EarnRulesCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const names = useCopy(loyaltyRulesContent)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<RuleForm | null>(null)

  // Helpers
  const title = (r: { type: string; key: string; title: string | null }) =>
    r.title || (r.type === 'social' ? names.platforms[r.key] : names.types[r.type]) || r.type
  const summary = (r: EarnRuleRow) => {
    const s = r.settings as { days?: number }
    if (r.type === 'daily_visit') return copy.rules.perDay(r.points)
    if (r.type === 'visit_streak') return copy.rules.streak(r.points, s.days ?? 7)
    if (r.type === 'product_review') return copy.rules.perProduct(r.points)
    if (r.type === 'birthday' || r.type === 'anniversary') return copy.rules.yearly(r.points)
    return copy.rules.points(r.points)
  }

  // Event handlers
  const handlePick = (choice: RuleChoice) => {
    setAdding(false)
    setEditing(newRuleForm(choice, rules.length))
  }

  const handleSaved = (row: EarnRuleRow) => {
    const exists = rules.some((r) => r.id === row.id)
    onRules(exists ? rules.map((r) => (r.id === row.id ? row : r)) : [...rules, row])
    setEditing(null)
  }

  const handleRemoved = (id: string) => {
    onRules(rules.filter((r) => r.id !== id))
    setEditing(null)
  }

  // Render logic
  const extra = rules.filter((r) => r.type !== 'order_spend')

  return (
    <DataCard
      title={copy.rules.heading}
      subtitle={copy.rules.help}
      count={extra.length}
      flush={extra.length > 0}
      action={
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus />
          {copy.rules.add}
        </Button>
      }
    >
      {extra.length === 0 ? (
        <EmptyState variant="dashed" body={copy.rules.empty} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {extra.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setEditing(ruleFormOf(r))}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted"
              >
                <RuleIcon type={r.type} ruleKey={r.key} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-medium text-ink-strong">{title(r)}</span>
                  <span className="text-caption text-muted-foreground">{summary(r)}</span>
                </span>
                <StatusChip tone={r.enabled ? 'success' : 'neutral'}>
                  {r.enabled ? copy.rules.on : copy.rules.off}
                </StatusChip>
              </button>
            </li>
          ))}
        </ul>
      )}
      <AddRuleDialog
        open={adding}
        rules={rules}
        onClose={() => setAdding(false)}
        onPick={handlePick}
      />
      {editing ? (
        <RuleEditorDialog
          form={editing}
          name={title({ ...editing, title: null })}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onRemoved={handleRemoved}
        />
      ) : null}
    </DataCard>
  )
}
