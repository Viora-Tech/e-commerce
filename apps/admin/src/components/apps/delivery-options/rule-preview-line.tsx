'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import type { RuleDraft } from './rule-draft'
import { rulePreview } from './rule-preview'

type RulePreviewLineProps = {
  draft: RuleDraft
  options: DeliveryOption[]
}

/** The rule dialog's live line: what the rule will do, in plain words, as it is edited (#1781). */
export default function RulePreviewLine({ draft, options }: RulePreviewLineProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)

  // Render logic
  const names = new Map(options.map((o) => [o.id, o.name]))
  const preview = rulePreview(draft, copy, pages, names)
  if (!preview) return null

  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-0.5 rounded-lg border border-info/30 bg-info-soft px-3 py-2.5"
    >
      <span className="text-caption font-medium text-info">{pages.rulePreview.label}</span>
      <span className="text-body text-ink-strong">{preview.text}</span>
      {preview.off ? (
        <span className="text-caption text-muted-foreground">{pages.rulePreview.off}</span>
      ) : null}
    </div>
  )
}
