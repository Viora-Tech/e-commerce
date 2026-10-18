'use client'

import type { Theme } from '@commerce/core/theme'
import { themesContent as copy } from '@/data/themes'
import ChoiceField from './choice-field'
import RangeField from './range-field'
import SwitchField from './switch-field'

type CardSettingsProps = {
  theme: Theme
  onChange: (next: Theme) => void
}

const STYLES = (['standard', 'minimal'] as const).map((value) => ({
  value,
  label: copy.cards.styles[value],
}))

const RATIOS = (['square', 'portrait', 'landscape', 'natural'] as const).map((value) => ({
  value,
  label: copy.cards.ratios[value],
}))

/** Product card image shape, extras and corner radius. */
export default function CardSettings({ theme, onChange }: CardSettingsProps) {
  // Helpers
  const setCards = (patch: Partial<Theme['cards']>) =>
    onChange({ ...theme, cards: { ...theme.cards, ...patch } })

  // Render logic
  const cards = theme.cards

  return (
    <>
      <ChoiceField
        label={copy.cards.style}
        value={cards.style}
        options={STYLES}
        onChange={(style) => setCards({ style })}
      />
      <ChoiceField
        label={copy.cards.ratio}
        value={cards.imageRatio}
        options={RATIOS}
        onChange={(imageRatio) => setCards({ imageRatio })}
      />
      <SwitchField
        label={copy.cards.vendor}
        checked={cards.showVendor}
        onChange={(showVendor) => setCards({ showVendor })}
      />
      <SwitchField
        label={copy.cards.saleBadge}
        checked={cards.showSaleBadge}
        onChange={(showSaleBadge) => setCards({ showSaleBadge })}
      />
      <SwitchField
        label={copy.cards.rating}
        help={copy.cards.ratingHelp}
        checked={cards.showRating}
        onChange={(showRating) => setCards({ showRating })}
      />
      <SwitchField
        label={copy.cards.quickAdd}
        checked={cards.showQuickAdd}
        onChange={(showQuickAdd) => setCards({ showQuickAdd })}
      />
      <SwitchField
        label={copy.cards.wishlist}
        checked={cards.showWishlist}
        onChange={(showWishlist) => setCards({ showWishlist })}
      />
      <SwitchField
        label={copy.cards.hoverImage}
        checked={cards.hoverImage}
        onChange={(hoverImage) => setCards({ hoverImage })}
      />
      <RangeField
        label={copy.cards.radius}
        value={theme.shape.cardRadius}
        min={0}
        max={40}
        step={1}
        format={copy.units.px}
        onChange={(cardRadius) => onChange({ ...theme, shape: { ...theme.shape, cardRadius } })}
      />
    </>
  )
}
