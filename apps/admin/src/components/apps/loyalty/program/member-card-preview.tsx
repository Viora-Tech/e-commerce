'use client'

import { type LoyaltySettings, pointsLabel } from '@commerce/core/loyalty'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { multiplierText, type TierDraft } from '@/lib/loyalty-program'
import { formatPaise } from '@/lib/money'

type MemberCardPreviewProps = {
  tier: TierDraft
  /** The tier above, for the "more to reach" line; null on the top tier. */
  next: TierDraft | null
  settings: LoyaltySettings
}

/** A sample points balance on the preview card. */
const SAMPLE_POINTS = 1240

/** The member card as shoppers see it on this tier, in the tier's colours, updating as you type. */
export default function MemberCardPreview({ tier, next, settings }: MemberCardPreviewProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const locale = useLocale()

  // Render logic
  const c = copy.tiers
  const gap = next ? Math.max(0, next.threshold - tier.threshold) : 0
  const gapText =
    settings.tierBasis === 'spend' ? formatPaise(gap, locale) : pointsLabel(gap, settings)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-muted-foreground">{c.preview}</span>
      <div
        className="flex aspect-[1.6] flex-col justify-between rounded-xl p-5 shadow-sm"
        style={{ backgroundColor: tier.colors.background, color: tier.colors.text }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-caption opacity-80">{c.previewName}</span>
          <span className="text-caption font-semibold">{multiplierText(tier.multiplierBp)}x</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-card-title font-semibold">{tier.name.trim() || c.unnamed}</span>
          <span className="text-body opacity-90">
            {c.previewPoints(pointsLabel(SAMPLE_POINTS, settings))}
          </span>
        </div>
        <span className="text-caption opacity-80">
          {next ? c.previewNext(gapText, next.name.trim() || c.unnamed) : c.previewTop}
        </span>
      </div>
    </div>
  )
}
