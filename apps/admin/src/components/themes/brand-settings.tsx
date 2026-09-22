'use client'

import type { Theme } from '@commerce/core/theme'
import { themesContent as copy } from '@/data/themes'
import MediaSlot from './media-slot'
import RangeField from './range-field'

type BrandSettingsProps = {
  theme: Theme
  onChange: (next: Theme) => void
}

/** Logo, logo width and favicon. Presets never touch these. */
export default function BrandSettings({ theme, onChange }: BrandSettingsProps) {
  // Helpers
  const setBrand = (patch: Partial<Theme['brand']>) =>
    onChange({ ...theme, brand: { ...theme.brand, ...patch } })

  // Render logic
  const brand = theme.brand

  return (
    <>
      <MediaSlot
        label={copy.brand.logo}
        help={copy.brand.logoHelp}
        dialogTitle={copy.brand.pickLogo}
        value={brand.logo}
        onChange={(logo) => setBrand({ logo })}
      />
      {brand.logo ? (
        <RangeField
          label={copy.brand.logoWidth}
          value={brand.logoWidth}
          min={60}
          max={320}
          step={4}
          format={copy.units.px}
          onChange={(logoWidth) => setBrand({ logoWidth })}
        />
      ) : null}
      <MediaSlot
        label={copy.brand.favicon}
        help={copy.brand.faviconHelp}
        dialogTitle={copy.brand.pickFavicon}
        value={brand.favicon}
        onChange={(favicon) => setBrand({ favicon })}
      />
    </>
  )
}
