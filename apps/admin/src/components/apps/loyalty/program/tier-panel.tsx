'use client'

import type { RewardRow } from '@commerce/core'
import { type LoyaltySettings, pointsLabel } from '@commerce/core/loyalty'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useState } from 'react'
import ColourInput from '@/components/metaobjects/colour-input'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { type TierDraft, thresholdFieldValue, thresholdFromField } from '@/lib/loyalty-program'
import { formatPaiseWhole } from '@/lib/money'
import ListRow from './list-row'
import MemberCardPreview from './member-card-preview'

type TierPanelProps = {
  tier: TierDraft
  /** The tier above, for the "more to reach" line; null on the top tier. */
  next: TierDraft | null
  /** The starting tier: everyone is on it, so it has no threshold to set. */
  first: boolean
  settings: LoyaltySettings
  rewards: RewardRow[]
  storeName: string
  onChange: (patch: Partial<TierDraft>) => void
  onRemove: () => void
}

type Row = 'name' | 'threshold' | 'tag' | 'reward' | 'text' | 'background'

/**
 * The right column for the picked tier: its card, then rows that open in place for the name,
 * where it starts, the customer tag, the reward on reaching it and the two card colours.
 */
export default function TierPanel({
  tier,
  next,
  first,
  settings,
  rewards,
  storeName,
  onChange,
  onRemove,
}: TierPanelProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const locale = useLocale()
  const [open, setOpen] = useState<Row | null>(null)

  // Helpers
  const toggle = (row: Row) => setOpen((o) => (o === row ? null : row))
  const amount = (n: number) =>
    settings.tierBasis === 'spend' ? formatPaiseWhole(n, locale) : pointsLabel(n, settings)
  const swatch = (colour: string) => (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-4 rounded-sm border border-line"
        style={{ backgroundColor: colour }}
      />
      <span className="font-mono text-caption uppercase">{colour}</span>
    </span>
  )

  // Render logic
  const c = copy.tiers
  const id = `tier-${tier.key}`
  const reward = rewards.find((r) => r.id === tier.rewardId)

  return (
    <div className="flex flex-col gap-4">
      <MemberCardPreview tier={tier} storeName={storeName} />
      {next ? (
        <p className="text-caption text-muted-foreground">
          {c.previewNext(
            amount(Math.max(0, next.threshold - tier.threshold)),
            next.name.trim() || c.unnamed,
          )}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1 rounded-lg border border-line bg-muted p-1">
        <ListRow
          raised
          label={c.name}
          value={tier.name.trim() || c.unnamed}
          open={open === 'name'}
          onToggle={() => toggle('name')}
        >
          <Input
            id={`${id}-name`}
            size="lg"
            maxLength={60}
            aria-label={c.name}
            value={tier.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </ListRow>
        <ListRow
          label={c.startsAt}
          value={first && tier.threshold === 0 ? c.starting : amount(tier.threshold)}
          open={open === 'threshold'}
          onToggle={() => toggle('threshold')}
        >
          <Field>
            <FieldLabel htmlFor={`${id}-threshold`}>{c.threshold[settings.tierBasis]}</FieldLabel>
            <Input
              id={`${id}-threshold`}
              size="lg"
              type="number"
              inputMode="numeric"
              min={0}
              value={thresholdFieldValue(tier.threshold, settings.tierBasis)}
              onChange={(e) =>
                onChange({
                  threshold: thresholdFromField(Number(e.target.value), settings.tierBasis),
                })
              }
            />
            <FieldDescription>{c.thresholdHelp[settings.tierWindow]}</FieldDescription>
          </Field>
        </ListRow>
        <ListRow
          label={c.tag}
          value={tier.customerTag.trim() || c.none}
          empty={tier.customerTag.trim() === ''}
          open={open === 'tag'}
          onToggle={() => toggle('tag')}
        >
          <Field>
            <Input
              id={`${id}-tag`}
              size="lg"
              maxLength={60}
              aria-label={c.tag}
              value={tier.customerTag}
              onChange={(e) => onChange({ customerTag: e.target.value })}
            />
            <FieldDescription>{c.tagHelp}</FieldDescription>
          </Field>
        </ListRow>
        <ListRow
          label={c.reward}
          value={reward?.title ?? c.rewardNone}
          open={open === 'reward'}
          onToggle={() => toggle('reward')}
        >
          <Field>
            <NativeSelect
              id={`${id}-reward`}
              aria-label={c.reward}
              value={tier.rewardId ?? ''}
              onChange={(e) => onChange({ rewardId: e.target.value || null })}
            >
              <NativeSelectOption value="">{c.rewardNone}</NativeSelectOption>
              {rewards.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>
                  {r.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>{c.rewardHelp}</FieldDescription>
          </Field>
        </ListRow>
        <ListRow
          label={c.text}
          value={swatch(tier.colors.text)}
          open={open === 'text'}
          onToggle={() => toggle('text')}
        >
          <ColourInput
            id={`${id}-text`}
            value={tier.colors.text}
            onChange={(text) => text && onChange({ colors: { ...tier.colors, text } })}
          />
        </ListRow>
        <ListRow
          label={c.background}
          value={swatch(tier.colors.background)}
          open={open === 'background'}
          onToggle={() => toggle('background')}
        >
          <ColourInput
            id={`${id}-bg`}
            value={tier.colors.background}
            onChange={(background) =>
              background && onChange({ colors: { ...tier.colors, background } })
            }
          />
        </ListRow>
      </ul>
      <div>
        <Button variant="outline" className="text-destructive" onClick={onRemove}>
          {c.remove}
        </Button>
      </div>
    </div>
  )
}
