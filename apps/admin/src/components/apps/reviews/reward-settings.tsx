'use client'

import type { ReviewsSettings } from '@commerce/plugin-reviews/settings'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import DataCard from '@/components/layout/data-card'
import { reviewToolsContent } from '@/data/review-tools'
import { useCopy } from '@/hooks/use-copy'

type RewardSettingsProps = {
  value: ReviewsSettings
  onChange: (patch: Partial<ReviewsSettings>) => void
}

/** A whole number from a number field, kept between `min` and `max`. */
const clamp = (raw: string, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number(raw) || min)))

/** Review settings: the discount code sent as thanks for a published photo review. */
export default function RewardSettings({ value, onChange }: RewardSettingsProps) {
  // Hooks
  const { reward: copy } = useCopy(reviewToolsContent)

  // Helpers
  const reward = (patch: Partial<ReviewsSettings['photoReward']>) =>
    onChange({ photoReward: { ...value.photoReward, ...patch } })

  // Render logic
  const r = value.photoReward

  return (
    <DataCard title={copy.title}>
      <div className="flex flex-col gap-4">
        <span className="text-caption text-muted-foreground">{copy.help}</span>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="reviews-reward-on">{copy.enabled}</Label>
          <Switch
            id="reviews-reward-on"
            checked={r.enabled}
            onCheckedChange={(v) => reward({ enabled: v })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reviews-reward-percent">{copy.percent}</Label>
            <InputGroup>
              <InputGroupInput
                id="reviews-reward-percent"
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                disabled={!r.enabled}
                value={r.percent}
                onChange={(ev) => reward({ percent: clamp(ev.target.value, 1, 90) })}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reviews-reward-days">{copy.days}</Label>
            <InputGroup>
              <InputGroupInput
                id="reviews-reward-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                disabled={!r.enabled}
                value={r.days}
                onChange={(ev) => reward({ days: clamp(ev.target.value, 1, 365) })}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{copy.daysUnit}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <span className="text-caption text-muted-foreground">{copy.note}</span>
      </div>
    </DataCard>
  )
}
