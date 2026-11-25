'use client'

import type { LoyaltySettings } from '@commerce/core/loyalty'
import { ChevronsUpDown } from '@commerce/ui/icons'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import NumberRow from '@/components/apps/cod-rto/number-row'
import SwitchRow from '@/components/fields/switch-row'
import TagInput from '@/components/fields/tag-input'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import type { SpendDraft, TierDraft } from '@/lib/loyalty-program'
import ListRow from './list-row'
import ListSection from './list-section'
import MultiplierField from './multiplier-field'

type SpendCardProps = {
  spend: SpendDraft
  settings: LoyaltySettings
  /** The tier picked in the strip; its multiplier is the per-tier rate. */
  tier: TierDraft | null
  onSpend: (patch: Partial<SpendDraft>) => void
  onSettings: (patch: Partial<LoyaltySettings>) => void
  onTier: (patch: Partial<TierDraft>) => void
}

type Row = 'rate' | 'exclude' | 'shipping'

/** Points per ₹100 on a tier: the base rate times its multiplier, rounded down like the earn. */
const tierPoints = (base: number, bp: number) => Math.floor((base * bp) / 10_000)

/**
 * Points per spend: the base rate (the order spend rule), or with the ⇅ switch the picked
 * tier's rate (its multiplier); products that earn nothing; shipping and taxes. Rows expand in place.
 */
export default function SpendCard({
  spend,
  settings,
  tier,
  onSpend,
  onSettings,
  onTier,
}: SpendCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [open, setOpen] = useState<Row | null>(null)
  const [perTier, setPerTier] = useState(false)

  // Helpers
  const toggle = (row: Row) => setOpen((o) => (o === row ? null : row))

  // Render logic
  const c = copy.spend
  const showTier = perTier && tier !== null
  const tierName = tier?.name.trim() || copy.tiers.unnamed
  const rate = showTier && tier ? tierPoints(spend.points, tier.multiplierBp) : spend.points
  const tags = spend.excludeProductTags
  const counted =
    settings.includeShipping && settings.includeTaxes
      ? c.countedBoth
      : settings.includeShipping
        ? c.countedShipping
        : settings.includeTaxes
          ? c.countedTaxes
          : c.countedNeither

  return (
    <ListSection
      title={
        <span className="flex items-center gap-1">
          {c.heading}
          {tier ? (
            <button
              type="button"
              aria-label={showTier ? c.showBase : c.showTier(tierName)}
              title={showTier ? c.showBase : c.showTier(tierName)}
              onClick={() => setPerTier((p) => !p)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronsUpDown className="size-4" />
            </button>
          ) : null}
        </span>
      }
      subtitle={c.help}
    >
      <ListRow
        raised
        label={showTier ? c.tierRow(tierName) : c.allProducts}
        badge={
          <StatusChip tone={showTier ? 'info' : 'neutral'} dot={false}>
            {showTier ? c.tierChip : c.baseChip}
          </StatusChip>
        }
        value={spend.enabled ? c.rateValue(rate) : c.off}
        open={open === 'rate'}
        onToggle={() => toggle('rate')}
      >
        {showTier && tier ? (
          <MultiplierField key={tier.key} tier={tier} onChange={onTier} />
        ) : (
          <>
            <SwitchRow
              label={c.enabled}
              checked={spend.enabled}
              onChange={(enabled) => onSpend({ enabled })}
            />
            <NumberRow
              id="loyalty-spend-rate"
              label={c.rate}
              description={c.rateHelp}
              value={spend.points}
              min={0}
              max={100}
              onChange={(points) => onSpend({ points })}
            />
          </>
        )}
      </ListRow>
      <ListRow
        label={c.excludeTags}
        value={tags.length === 0 ? c.none : tags.join(', ')}
        open={open === 'exclude'}
        onToggle={() => toggle('exclude')}
      >
        <Field>
          <FieldLabel htmlFor="loyalty-spend-exclude">{c.excludeTagsLabel}</FieldLabel>
          <TagInput
            id="loyalty-spend-exclude"
            tags={tags}
            suggestions={[]}
            placeholder={c.tagPlaceholder}
            onChange={(excludeProductTags) => onSpend({ excludeProductTags })}
          />
          <FieldDescription>{c.excludeTagsHelp}</FieldDescription>
        </Field>
      </ListRow>
      <ListRow label={counted} open={open === 'shipping'} onToggle={() => toggle('shipping')}>
        <SwitchRow
          label={c.shipping}
          description={c.shippingHelp}
          checked={settings.includeShipping}
          onChange={(includeShipping) => onSettings({ includeShipping })}
        />
        <SwitchRow
          label={c.taxes}
          description={c.taxesHelp}
          checked={settings.includeTaxes}
          onChange={(includeTaxes) => onSettings({ includeTaxes })}
        />
      </ListRow>
    </ListSection>
  )
}
