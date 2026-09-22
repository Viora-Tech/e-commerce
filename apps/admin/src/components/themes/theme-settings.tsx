'use client'

import type { Theme } from '@commerce/core/theme'
import { themesContent as copy } from '@/data/themes'
import BrandSettings from './brand-settings'
import ButtonSettings from './button-settings'
import CardSettings from './card-settings'
import ColourSettings from './colour-settings'
import LayoutSettings from './layout-settings'
import SettingGroup from './setting-group'
import TypographySettings from './typography-settings'

type ThemeSettingsProps = {
  theme: Theme
  mode: 'light' | 'dark'
  onChange: (next: Theme) => void
}

/** The left panel: every theme setting, grouped and collapsible. */
export default function ThemeSettings({ theme, mode, onChange }: ThemeSettingsProps) {
  return (
    <div className="flex flex-col">
      <SettingGroup title={copy.groups.colours} defaultOpen>
        <ColourSettings theme={theme} mode={mode} onChange={onChange} />
      </SettingGroup>
      <SettingGroup title={copy.groups.typography}>
        <TypographySettings theme={theme} onChange={onChange} />
      </SettingGroup>
      <SettingGroup title={copy.groups.buttons}>
        <ButtonSettings theme={theme} mode={mode} onChange={onChange} />
      </SettingGroup>
      <SettingGroup title={copy.groups.cards}>
        <CardSettings theme={theme} onChange={onChange} />
      </SettingGroup>
      <SettingGroup title={copy.groups.layout}>
        <LayoutSettings theme={theme} onChange={onChange} />
      </SettingGroup>
      <SettingGroup title={copy.groups.brand}>
        <BrandSettings theme={theme} onChange={onChange} />
      </SettingGroup>
    </div>
  )
}
