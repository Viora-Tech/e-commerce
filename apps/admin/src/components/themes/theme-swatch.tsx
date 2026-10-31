import { THEME_FONTS, type Theme } from '@commerce/core/theme'
import { cn } from '@commerce/ui/lib/utils'
import { themesContent as copy } from '@/data/themes'

type ThemeSwatchProps = {
  theme: Theme
  /** The theme's name, written in its heading face instead of "Aa" (audit #144). */
  name?: string | undefined
  className?: string
}

const rem = (px: number) => `${px / 16}rem`

/** A small card drawn in a theme's own light colours, heading face and button shape. */
export default function ThemeSwatch({ theme, name, className }: ThemeSwatchProps) {
  // Render logic
  const scheme = theme.schemes.find((s) => s.id === theme.lightScheme) ?? theme.schemes[0]
  const background = scheme?.background ?? '#FFFFFF'
  const text = scheme?.text ?? '#111111'
  const button = theme.buttons.colour === 'brand' ? (scheme?.button ?? text) : text
  const palette = [background, text, button, scheme?.accent ?? button]

  return (
    <span
      aria-hidden
      className={cn('flex flex-col justify-between gap-2 border border-border p-3', className)}
      style={{ backgroundColor: background, color: text }}
    >
      <span
        className={cn('leading-none font-semibold', name ? 'line-clamp-2 text-base' : 'text-xl')}
        style={{ fontFamily: `"${THEME_FONTS[theme.fonts.heading].label}"` }}
      >
        {name || copy.contrast.swatch}
      </span>
      <span className="flex items-center gap-1">
        <span
          className="h-3 w-8"
          style={{
            backgroundColor: button,
            borderRadius: rem(Math.min(theme.shape.buttonRadius, 8)),
          }}
        />
        {name ? (
          // Its colours, so a theme without a screenshot still reads as itself.
          palette.map((colour, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: four fixed slots
              key={i}
              className="size-3 rounded-full border"
              style={{ backgroundColor: colour, borderColor: scheme?.line ?? text }}
            />
          ))
        ) : (
          <span
            className="size-3 rounded-full border"
            style={{ backgroundColor: scheme?.accent ?? button, borderColor: scheme?.line ?? text }}
          />
        )}
      </span>
    </span>
  )
}
