import { THEME_FONTS, type Theme } from '@commerce/core/theme'
import { cn } from '@commerce/ui/lib/utils'
import { themesContent as copy } from '@/data/themes'

type ThemeSwatchProps = {
  theme: Theme
  className?: string
}

const rem = (px: number) => `${px / 16}rem`

/** A small card drawn in a theme's own light colours, heading face and button shape. */
export default function ThemeSwatch({ theme, className }: ThemeSwatchProps) {
  // Render logic
  const scheme = theme.schemes.find((s) => s.id === theme.lightScheme) ?? theme.schemes[0]
  const background = scheme?.background ?? '#FFFFFF'
  const text = scheme?.text ?? '#111111'
  const button = theme.buttons.colour === 'brand' ? (scheme?.button ?? text) : text

  return (
    <span
      aria-hidden
      className={cn('flex flex-col justify-between gap-2 border border-border p-3', className)}
      style={{ backgroundColor: background, color: text }}
    >
      <span
        className="text-xl leading-none font-semibold"
        style={{ fontFamily: `"${THEME_FONTS[theme.fonts.heading].label}"` }}
      >
        {copy.contrast.swatch}
      </span>
      <span className="flex items-center gap-1">
        <span
          className="h-3 w-8"
          style={{
            backgroundColor: button,
            borderRadius: rem(Math.min(theme.shape.buttonRadius, 8)),
          }}
        />
        <span
          className="size-3 rounded-full border"
          style={{ backgroundColor: scheme?.accent ?? button, borderColor: scheme?.line ?? text }}
        />
      </span>
    </span>
  )
}
