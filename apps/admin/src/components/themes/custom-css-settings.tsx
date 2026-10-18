'use client'

import type { Theme } from '@commerce/core/theme'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { themesContent as copy } from '@/data/themes'

type CustomCssSettingsProps = {
  theme: Theme
  onChange: (next: Theme) => void
}

/** Matches `customCss` in ThemeSchema. */
const MAX = 20_000

/** Theme settings → Custom CSS (native themes): added after the theme's CSS on every page. */
export default function CustomCssSettings({ theme, onChange }: CustomCssSettingsProps) {
  // Render logic
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="theme-custom-css" className="text-xs font-medium text-foreground">
        {copy.css.label}
      </label>
      <Textarea
        id="theme-custom-css"
        value={theme.customCss}
        maxLength={MAX}
        rows={14}
        spellCheck={false}
        placeholder={copy.css.placeholder}
        onChange={(e) => onChange({ ...theme, customCss: e.target.value })}
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground tabular-nums">
        {copy.css.limit(theme.customCss.length, MAX)}
      </p>
    </div>
  )
}
