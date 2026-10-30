'use client'

import type { ReviewsSettings } from '@commerce/plugin-reviews/settings'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import DataCard from '@/components/layout/data-card'
import { reviewToolsContent } from '@/data/review-tools'
import { useCopy } from '@/hooks/use-copy'

type AiSummarySettingsProps = {
  value: ReviewsSettings
  onChange: (patch: Partial<ReviewsSettings>) => void
}

/** Review settings: the AI "What customers say" summary on product pages. */
export default function AiSummarySettings({ value, onChange }: AiSummarySettingsProps) {
  // Hooks
  const { summary: copy } = useCopy(reviewToolsContent)

  return (
    <DataCard title={copy.title}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <Label htmlFor="reviews-ai-summary">{copy.enabled}</Label>
            <span className="text-caption text-muted-foreground">{copy.help}</span>
          </div>
          <Switch
            id="reviews-ai-summary"
            checked={value.aiSummary.enabled}
            onCheckedChange={(v) => onChange({ aiSummary: { enabled: v } })}
          />
        </div>
        <span className="text-caption text-muted-foreground">{copy.note}</span>
      </div>
    </DataCard>
  )
}
