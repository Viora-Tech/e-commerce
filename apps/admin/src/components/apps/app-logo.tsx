import { APP_ICONS, APP_LOGOS } from '@commerce/core/app-logos'
import { cn } from '@commerce/ui/lib/utils'
import { appIcon } from '@/apps/app-icons'

type AppLogoProps = {
  /** The plugin id: picks the real third-party logo or the built-in tile colour. */
  id: string
  icon: string | null
  size?: 28 | 44 | 48 | 72 | 160
  className?: string
}

/** Fallback for an app with no designed icon yet: a gradient tile with a white glyph. */
const TILES: Record<string, string> = {
  reviews: 'from-amber-400 to-amber-600 border-amber-600/90',
  'gst-invoices': 'from-blue-500 to-blue-700 border-blue-700/90',
  'back-in-stock': 'from-emerald-500 to-emerald-700 border-emerald-700/90',
  'emi-pay-later': 'from-violet-500 to-violet-700 border-violet-700/90',
  forms: 'from-sky-500 to-sky-700 border-sky-700/90',
  'shopify-import': 'from-lime-500 to-lime-700 border-lime-700/90',
}

const FALLBACK_TILE = 'from-slate-500 to-slate-700 border-slate-700/90'

/** Pixel size to rem class pairs, so the tile and its glyph scale together. */
const SIZES = {
  28: { box: 'size-7 rounded-[0.4375rem]', logo: 'size-[1.1rem]', glyph: 'size-4', icon: 'size-7' },
  44: {
    box: 'size-11 rounded-[0.625rem]',
    logo: 'size-[1.7rem]',
    glyph: 'size-6',
    icon: 'size-11',
  },
  48: {
    box: 'size-12 rounded-[0.8125rem]',
    logo: 'size-[2.7rem]',
    glyph: 'size-6',
    icon: 'size-12',
  },
  72: {
    box: 'size-[4.5rem] rounded-2xl',
    logo: 'size-[3.75rem]',
    glyph: 'size-9',
    icon: 'size-[4.5rem]',
  },
  160: {
    box: 'size-40 rounded-[1.25rem]',
    logo: 'size-[6.1rem]',
    glyph: 'size-20',
    icon: 'size-40',
  },
} as const

/** App logo (Figma "App logo"): our designed icon for built-ins, official logo on white for third parties. */
export default function AppLogo({ id, icon, size = 44, className }: AppLogoProps) {
  // Render logic
  const dims = SIZES[size]
  // Real third-party logos, shown on a white tile (trademarks of their owners).
  const src = APP_LOGOS[id]
  // Our own apps: the designed icon, tile and corners included.
  const own = APP_ICONS[id]

  if (own) {
    return (
      // biome-ignore lint/performance/noImgElement: fixed local icon files, not content
      <img src={own} alt="" aria-hidden="true" className={cn('shrink-0', dims.icon, className)} />
    )
  }

  if (src) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden border border-border bg-white',
          dims.box,
          className,
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: fixed local brand assets, not content */}
        <img src={src} alt="" className={cn('object-contain', dims.logo)} />
      </span>
    )
  }

  const Glyph = appIcon(icon)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center border bg-gradient-to-b text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.22),inset_0_1px_0_rgb(255_255_255/0.45)]',
        TILES[id] ?? FALLBACK_TILE,
        dims.box,
        className,
      )}
    >
      <Glyph className={dims.glyph} />
    </span>
  )
}
