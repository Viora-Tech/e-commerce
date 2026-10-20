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
  bluedart: '/app-logos/bluedart.svg',
  cashfree: '/app-logos/cashfree.png',
  chatwoot: '/app-logos/chatwoot.svg',
  decentro: '/app-logos/decentro.png',
  delhivery: '/app-logos/delhivery.png',
  'dhl-express': '/app-logos/dhl-express.svg',
  dtdc: '/app-logos/dtdc.png',
  ekart: '/app-logos/ekart.png',
  fedex: '/app-logos/fedex.svg',
  'google-search-console': '/app-logos/google-search-console.svg',
  growthbook: '/app-logos/growthbook.png',
  'india-post': '/app-logos/india-post.png',
  meilisearch: '/app-logos/meilisearch.svg',
  r2: '/app-logos/r2.svg',
  rapidshyp: '/app-logos/rapidshyp.png',
  razorpay: '/app-logos/razorpay.svg',
  s3: '/app-logos/s3.svg',
  ses: '/app-logos/ses.svg',
  shadowfax: '/app-logos/shadowfax.png',
  shiprocket: '/app-logos/shiprocket.png',
  umami: '/app-logos/umami.svg',
  whatsapp: '/app-logos/whatsapp.svg',
  xpressbees: '/app-logos/xpressbees.png',
}

/** Built-in family: one gradient tile per app, a white glyph on top. */
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
