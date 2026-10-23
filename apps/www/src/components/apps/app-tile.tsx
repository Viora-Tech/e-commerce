import { APP_LOGOS } from '@commerce/core/app-logos'
import { cn } from '@commerce/ui/lib/utils'

type AppTileProps = {
  id: string
  name: string
  size?: 'md' | 'lg'
}

const SIZES = {
  md: { box: 'size-11 rounded-xl text-sm', logo: 'size-7' },
  lg: { box: 'size-16 rounded-2xl text-lg', logo: 'size-11' },
} as const

/** An app's logo on a white tile (trademarks of their owners), or its initials for our own apps. */
export default function AppTile({ id, name, size = 'md' }: AppTileProps) {
  // Render logic
  const dims = SIZES[size]
  const src = APP_LOGOS[id]

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden border border-border font-semibold',
        src ? 'bg-white' : 'bg-card text-foreground',
        dims.box,
      )}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: small fixed brand files; next/image adds nothing in a static export
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn('object-contain', dims.logo)}
        />
      ) : (
        name.slice(0, 2)
      )}
    </span>
  )
}
