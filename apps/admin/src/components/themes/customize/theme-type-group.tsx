'use client'

import type { Theme } from '@commerce/core/theme'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { SIZE_SCALES, type SizeScale, sizeScaleOf } from '@/lib/theme-quick-settings'
import FontPicker from '../font-picker'
import TypographySettings from '../typography-settings'
import MoreSettings from './more-settings'
import SettingsSegmented from './settings-segmented'

type ThemeTypeGroupProps = {
  theme: Theme
  onChange: (next: Theme) => void
}

const SIZES: SizeScale[] = ['s', 'm', 'l']

/** Theme settings › Typography: heading and body fonts, a size choice, then every type setting. */
export default function ThemeTypeGroup({ theme, onChange }: ThemeTypeGroupProps) {
  // Hooks
  const copy = useCopy(customizeContent.themePanel)

  // Render logic
  return (
    <>
      <FontPicker
        compact
        label={copy.headingFont}
        kind="heading"
        value={theme.fonts.heading}
        onChange={(heading) => onChange({ ...theme, fonts: { ...theme.fonts, heading } })}
      />
      <FontPicker
        compact
        label={copy.bodyFont}
        kind="body"
        value={theme.fonts.body}
        onChange={(body) => onChange({ ...theme, fonts: { ...theme.fonts, body } })}
      />
      <SettingsSegmented
        label={copy.sizeScale}
        value={sizeScaleOf(theme.fonts)}
        options={SIZES.map((id) => ({ value: id, label: copy.sizes[id] }))}
        onChange={(id) => onChange({ ...theme, fonts: { ...theme.fonts, ...SIZE_SCALES[id] } })}
      />
      <MoreSettings label={copy.moreType}>
        <TypographySettings theme={theme} onChange={onChange} pickers={false} />
      </MoreSettings>
    </>
  )
}
