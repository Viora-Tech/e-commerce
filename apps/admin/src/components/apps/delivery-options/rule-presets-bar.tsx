'use client'

import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { useCopy } from '@/hooks/use-copy'
import { RULE_PRESETS, type RulePreset } from './rule-presets'

type RulePresetsBarProps = {
  onPick: (preset: RulePreset) => void
}

/**
 * The quick starts above a new rule (owner, 20 Nov 2026): "Free with a preferred courier" (like
 * mice), "One courier only, free" (like glass pads), "Paid, cheapest first" (like skates). Each
 * fills the form; nothing saves until Save.
 */
export default function RulePresetsBar({ onPick }: RulePresetsBarProps) {
  // Hooks
  const form = useCopy(deliveryRuleFormContent)

  // Render logic
  const t = form.presets

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-body font-medium text-ink-strong">{t.label}</span>
        <span className="text-caption text-muted-foreground">{t.help}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {RULE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="flex flex-col items-start gap-1 rounded-lg border border-panel-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-body font-medium text-ink-strong">{t.items[p].title}</span>
            <span className="text-caption text-muted-foreground">{t.items[p].body}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
