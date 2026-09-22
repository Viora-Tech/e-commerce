'use client'

import type { Theme } from '@commerce/core/theme'
import { themesContent as copy } from '@/data/themes'
import RangeField from './range-field'
import SwitchField from './switch-field'

type LayoutSettingsProps = {
  theme: Theme
  onChange: (next: Theme) => void
}

/** Page width, section rhythm, section corners, input radius and border weight. */
export default function LayoutSettings({ theme, onChange }: LayoutSettingsProps) {
  // Helpers
  const setLayout = (patch: Partial<Theme['layout']>) =>
    onChange({ ...theme, layout: { ...theme.layout, ...patch } })
  const setShape = (patch: Partial<Theme['shape']>) =>
    onChange({ ...theme, shape: { ...theme.shape, ...patch } })

  return (
    <>
      <RangeField
        label={copy.layout.pageWidth}
        value={theme.layout.pageWidth}
        min={960}
        max={1920}
        step={20}
        format={copy.units.px}
        onChange={(pageWidth) => setLayout({ pageWidth })}
      />
      <RangeField
        label={copy.layout.sectionSpacing}
        value={theme.layout.sectionSpacing}
        min={0.5}
        max={1.5}
        step={0.05}
        format={copy.units.times}
        onChange={(sectionSpacing) => setLayout({ sectionSpacing })}
      />
      <SwitchField
        label={copy.layout.roundedSections}
        checked={theme.roundedSections}
        onChange={(roundedSections) => onChange({ ...theme, roundedSections })}
      />
      <RangeField
        label={copy.layout.inputRadius}
        value={theme.shape.inputRadius}
        min={0}
        max={40}
        step={1}
        format={copy.units.px}
        onChange={(inputRadius) => setShape({ inputRadius })}
      />
      <RangeField
        label={copy.layout.borderWidth}
        value={theme.shape.borderWidth}
        min={0}
        max={4}
        step={1}
        format={copy.units.px}
        onChange={(borderWidth) => setShape({ borderWidth })}
      />
    </>
  )
}
