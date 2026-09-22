'use client'

import { THEME_FONT_IDS, THEME_FONTS, type ThemeFontId } from '@commerce/core/theme'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { themesContent as copy } from '@/data/themes'

type FontPickerProps = {
  label: string
  value: ThemeFontId
  /** Headings render the sample larger and bolder. */
  kind: 'heading' | 'body'
  onChange: (id: ThemeFontId) => void
}

const items = THEME_FONT_IDS.map((id) => ({ value: id, label: THEME_FONTS[id].label }))
const byCategory = (['sans', 'serif'] as const).map((category) => ({
  category,
  ids: THEME_FONT_IDS.filter((id) => THEME_FONTS[id].category === category),
}))

/** The admin loads every curated face from Google Fonts (see ThemeEditor) so samples are real. */
const family = (id: ThemeFontId) => ({ fontFamily: `"${THEME_FONTS[id].label}"` })

/** Font dropdown where each option is set in its own face, with a live sample underneath. */
export default function FontPicker({ label, value, kind, onChange }: FontPickerProps) {
  // Event handlers
  const handleChange = (next: unknown) => {
    const id = THEME_FONT_IDS.find((f) => f === next)
    if (id) onChange(id)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body text-foreground">{label}</span>
      <Select items={items} value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-full" aria-label={label} style={family(value)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {byCategory.map((group) => (
            <SelectGroup key={group.category}>
              <SelectLabel>{copy.typography.categories[group.category]}</SelectLabel>
              {group.ids.map((id) => (
                <SelectItem key={id} value={id} style={family(id)}>
                  {THEME_FONTS[id].label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p
        className={
          kind === 'heading'
            ? 'rounded-md bg-muted px-3 py-2 text-xl leading-tight font-semibold text-foreground'
            : 'rounded-md bg-muted px-3 py-2 text-body text-foreground'
        }
        style={family(value)}
      >
        {copy.typography.sample}
      </p>
    </div>
  )
}
