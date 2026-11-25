'use client'

import { loyaltyProgramContent } from '@/data/loyalty-program'
import { loyaltyRulesContent } from '@/data/loyalty-rules'
import { useCopy } from '@/hooks/use-copy'
import type { RuleForm } from '@/lib/loyalty-rules'
import RuleIcon from './rule-icon'
import { ruleValue } from './rule-text'

type RulePreviewProps = {
  form: RuleForm
  name: string
}

/** The rule as shoppers see it in the loyalty panel: glyph, title, points line and its link. */
export default function RulePreview({ form, name }: RulePreviewProps) {
  // Hooks
  const copy = useCopy(loyaltyRulesContent)
  const program = useCopy(loyaltyProgramContent)

  // Render logic
  const e = copy.editor
  const cta = form.type === 'social' ? e.actions[form.action] : (e.cta[form.type] ?? e.cta.default)

  return (
    <aside className="flex flex-col gap-2 lg:sticky lg:top-24">
      <span className="text-caption font-medium text-muted-foreground">{e.preview}</span>
      <div className="rounded-lg bg-muted p-5">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-card p-4 shadow-xs">
          <RuleIcon type={form.type} ruleKey={form.key} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body font-medium text-ink-strong">
              {form.title.trim() || name}
            </span>
            <span className="text-caption text-muted-foreground">
              {ruleValue(form, program.rules, form.days)}
            </span>
          </span>
          <span className="shrink-0 text-body font-medium text-primary underline-offset-2">
            {cta}
          </span>
        </div>
      </div>
      <p className="text-caption text-muted-foreground">{e.previewHelp}</p>
    </aside>
  )
}
