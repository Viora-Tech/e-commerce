'use client'

import type { EarnRuleRow } from '@commerce/core'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyRulesContent } from '@/data/loyalty-rules'
import { useCopy } from '@/hooks/use-copy'
import { RULE_CATALOG, type RuleChoice, type RuleGroup, ruleKey } from '@/lib/loyalty-rules'
import RuleIcon from './rule-icon'

type AddRuleDialogProps = {
  open: boolean
  rules: EarnRuleRow[]
  onClose: () => void
  onPick: (choice: RuleChoice) => void
}

const GROUPS: RuleGroup[] = ['store', 'reviews', 'social']

/** "Add a way to earn": every rule type grouped, the ones already added marked and not pickable. */
export default function AddRuleDialog({ open, rules, onClose, onPick }: AddRuleDialogProps) {
  // Hooks
  const copy = useCopy(loyaltyRulesContent)

  // Render logic
  const taken = new Set(rules.map(ruleKey))

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent size="wide">
        <div className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.add.title}</DialogTitle>
            <DialogDescription>{copy.add.description}</DialogDescription>
          </DialogHeader>
          {GROUPS.map((group) => (
            <section key={group} className="flex flex-col gap-2">
              <h3 className="text-caption font-medium text-muted-foreground">
                {copy.groups[group]}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {RULE_CATALOG.filter((c) => c.group === group).map((c) => {
                  const added = taken.has(ruleKey(c))
                  return (
                    <button
                      key={ruleKey(c)}
                      type="button"
                      disabled={added}
                      onClick={() => onPick(c)}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                    >
                      <RuleIcon type={c.type} ruleKey={c.key} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body font-medium text-ink-strong">
                          {c.type === 'social' ? copy.platforms[c.key] : copy.types[c.type]}
                        </span>
                        <span className="text-caption text-muted-foreground">
                          {copy.hints[c.type]}
                        </span>
                      </span>
                      {added ? (
                        <StatusChip tone="neutral" dot={false}>
                          {copy.add.added}
                        </StatusChip>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
