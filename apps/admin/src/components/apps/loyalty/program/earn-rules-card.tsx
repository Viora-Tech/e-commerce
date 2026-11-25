'use client'

import type { EarnRuleRow } from '@commerce/core'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { loyaltyRulesContent } from '@/data/loyalty-rules'
import { useCopy } from '@/hooks/use-copy'
import { newRuleForm, type RuleChoice, type RuleForm, ruleFormOf } from '@/lib/loyalty-rules'
import AddRuleDialog from './add-rule-dialog'
import ListRow from './list-row'
import ListSection from './list-section'
import RuleIcon from './rule-icon'
import RuleSheet from './rule-sheet'
import { ruleName, ruleValue, standardName } from './rule-text'

type EarnRulesCardProps = {
  rules: EarnRuleRow[]
  onRules: (rules: EarnRuleRow[]) => void
}

/** Earning rules besides orders: each row opens the rule sheet; + Rule opens the catalog. */
export default function EarnRulesCard({ rules, onRules }: EarnRulesCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const names = useCopy(loyaltyRulesContent)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<RuleForm | null>(null)

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
    <ListSection
      title={copy.rules.heading}
      subtitle={copy.rules.help}
      action={
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus />
          {copy.rules.add}
        </Button>
      }
    >
      {extra.length === 0 ? (
        <li>
          <EmptyState variant="dashed" body={copy.rules.empty} />
        </li>
      ) : null}
      {extra.map((r, i) => (
        <ListRow
          key={r.id}
          raised={i === 0}
          icon={<RuleIcon type={r.type} ruleKey={r.key} />}
          label={ruleName(r, names)}
          badge={
            r.enabled ? null : (
              <StatusChip tone="neutral" dot={false}>
                {copy.rules.off}
              </StatusChip>
            )
          }
          value={ruleValue(r, copy.rules)}
          onOpen={() => setEditing(ruleFormOf(r))}
        />
      ))}
      <AddRuleDialog
        open={adding}
        rules={rules}
        onClose={() => setAdding(false)}
        onPick={handlePick}
      />
      {editing ? (
        <RuleSheet
          form={editing}
          name={standardName(editing, names)}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onRemoved={handleRemoved}
        />
      ) : null}
    </ListSection>
  )
}
