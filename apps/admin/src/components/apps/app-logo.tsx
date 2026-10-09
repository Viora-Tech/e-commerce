import { cn } from '@commerce/ui/lib/utils'
import { appIcon } from '@/apps/registry'

type AppLogoProps = {
  /** The plugin id: picks the real third-party logo or the built-in tile colour. */
  id: string
  icon: string | null
  size?: 44 | 48 | 72 | 160
  className?: string
}

/** Real third-party logos under `public/app-logos`, shown on a white tile (trademarks of their owners). */
const LOGOS: Record<string, string> = {
  cashfree: '/app-logos/cashfree.png',
  decentro: '/app-logos/decentro.png',
  delhivery: '/app-logos/delhivery.png',
  rapidshyp: '/app-logos/rapidshyp.png',
  razorpay: '/app-logos/razorpay.svg',
  shiprocket: '/app-logos/shiprocket.png',
}

/** Built-in family: one gradient tile per app, a white glyph on top. */
const TILES: Record<string, string> = {
  reviews: 'from-amber-400 to-amber-600 border-amber-600/90',
  'gst-invoices': 'from-blue-500 to-blue-700 border-blue-700/90',
  'back-in-stock': 'from-emerald-500 to-emerald-700 border-emerald-700/90',
  'emi-pay-later': 'from-violet-500 to-violet-700 border-violet-700/90',
  whatsapp: 'from-green-500 to-green-700 border-green-700/90',
  forms: 'from-sky-500 to-sky-700 border-sky-700/90',
  'shopify-import': 'from-lime-500 to-lime-700 border-lime-700/90',
  ses: 'from-orange-500 to-orange-700 border-orange-700/90',
  s3: 'from-rose-500 to-rose-700 border-rose-700/90',
}

const FALLBACK_TILE = 'from-slate-500 to-slate-700 border-slate-700/90'

/** Pixel size to rem class pairs, so the tile and its glyph scale together. */
const SIZES = {
  44: { box: 'size-11 rounded-[0.625rem]', logo: 'size-[1.7rem]', glyph: 'size-6' },
  48: { box: 'size-12 rounded-[0.8125rem]', logo: 'size-[2.7rem]', glyph: 'size-6' },
  72: { box: 'size-[4.5rem] rounded-2xl', logo: 'size-[3.75rem]', glyph: 'size-9' },
  160: { box: 'size-40 rounded-[1.25rem]', logo: 'size-[6.1rem]', glyph: 'size-20' },
} as const

/** App logo (Figma "App logo"): official logo on white for third parties, vector tile for built-ins. */
export default function AppLogo({ id, icon, size = 44, className }: AppLogoProps) {
  // Render logic
  const dims = SIZES[size]
  const src = LOGOS[id]

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
