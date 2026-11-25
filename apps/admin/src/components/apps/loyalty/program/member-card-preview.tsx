'use client'

import { QrCodeIcon, Sparkle } from '@commerce/ui/icons'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { multiplierText, type TierDraft } from '@/lib/loyalty-program'

type MemberCardPreviewProps = {
  tier: TierDraft
  storeName: string
}

/**
 * The tier card as members see it, in the tier's colours with a soft gradient: a glyph chip and
 * the store's name on top, the tier's name and earning rate below, a QR mark in the corner.
 */
export default function MemberCardPreview({ tier, storeName }: MemberCardPreviewProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)

  // Render logic
  const c = copy.tiers
  const { background, text } = tier.colors

  return (
    <figure
      aria-label={c.preview}
      className="flex aspect-[1.6] flex-col justify-between rounded-2xl p-5 shadow-sm"
      style={{
        backgroundImage: `linear-gradient(135deg, ${background} 0%, color-mix(in srgb, ${background} 65%, #000) 100%)`,
        color: text,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/20">
          <Sparkle className="size-4" />
        </span>
        <span className="truncate text-caption font-medium opacity-90">
          {storeName || c.previewStore}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-page-title">{tier.name.trim() || c.unnamed}</span>
          <span className="text-caption opacity-80">
            {c.previewEarns(multiplierText(tier.multiplierBp))}
          </span>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/90 text-black">
          <QrCodeIcon className="size-8" />
        </span>
      </div>
    </figure>
  )
}
