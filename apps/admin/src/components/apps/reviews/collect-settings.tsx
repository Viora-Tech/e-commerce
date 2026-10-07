'use client'

import type { PublishMode, ReviewsSettings, WhoCanReview } from '@commerce/plugin-reviews/settings'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Switch } from '@commerce/ui/shadcn/switch'
import DataCard from '@/components/layout/data-card'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'

type CollectSettingsProps = {
  value: ReviewsSettings
  onChange: (patch: Partial<ReviewsSettings>) => void
}

const MODES: PublishMode[] = ['all', 'high', 'none']
const WHO: WhoCanReview[] = ['verified', 'anyone']

type OptionProps = { id: string; value: string; label: string; help: string }

function Option({ id, value, label, help }: OptionProps) {
  return (
    <label htmlFor={id} className="flex items-start gap-2">
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="flex flex-col">
        <span className="text-body">{label}</span>
        <span className="text-caption text-muted-foreground">{help}</span>
      </span>
    </label>
  )
}

/** Left column of Review settings: publishing, who can review, spam protection. */
export default function CollectSettings({ value, onChange }: CollectSettingsProps) {
  // Hooks
  const { settings: copy } = useCopy(reviewsContent)

  // Render logic
  const p = copy.publishing

  return (
    <>
      <DataCard title={p.title}>
        <div className="flex flex-col gap-3">
          <span className="text-caption text-muted-foreground">{p.help}</span>
          <RadioGroup
            value={value.publishing}
            onValueChange={(v) => onChange({ publishing: v as PublishMode })}
          >
            {MODES.map((m) => (
              <Option
                key={m}
                id={`reviews-publish-${m}`}
                value={m}
                label={p[m]}
                help={p[`${m}Help`]}
              />
            ))}
          </RadioGroup>
          <label htmlFor="reviews-hold-photos" className="flex items-start gap-2">
            <Checkbox
              id="reviews-hold-photos"
              checked={value.holdPhotos}
              onCheckedChange={(v) => onChange({ holdPhotos: v === true })}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="text-body">{p.photos}</span>
              <span className="text-caption text-muted-foreground">{p.photosHelp}</span>
            </span>
          </label>
        </div>
      </DataCard>
      <DataCard title={copy.who.title}>
        <RadioGroup
          value={value.whoCanReview}
          onValueChange={(v) => onChange({ whoCanReview: v as WhoCanReview })}
        >
          {WHO.map((w) => (
            <Option
              key={w}
              id={`reviews-who-${w}`}
              value={w}
              label={copy.who[w]}
              help={copy.who[`${w}Help`]}
            />
          ))}
        </RadioGroup>
      </DataCard>
      <DataCard title={copy.spam.title}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <Label htmlFor="reviews-bots">{copy.spam.bots}</Label>
              <span className="text-caption text-muted-foreground">{copy.spam.botsHelp}</span>
            </div>
            <Switch id="reviews-bots" checked disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reviews-per-day">{copy.spam.perDay}</Label>
            <Input
              id="reviews-per-day"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={value.maxPerDay}
              onChange={(e) =>
                onChange({ maxPerDay: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })
              }
              className="w-32"
            />
          </div>
        </div>
      </DataCard>
    </>
  )
}
