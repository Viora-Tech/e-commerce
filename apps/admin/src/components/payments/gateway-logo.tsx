import { APP_LOGOS } from '@commerce/core/app-logos'
import { cn } from '@commerce/ui/lib/utils'

type GatewayLogoProps = {
  /** The gateway id; picks its real logo from the shared app logo set. */
  id: string
  /** Letters drawn when the gateway has no logo file yet. */
  monogram: string
  size?: 'sm' | 'lg'
}

/** A payment company's logo on a white tile (same files as Apps), or a letter tile without one. */
export default function GatewayLogo({ id, monogram, size = 'sm' }: GatewayLogoProps) {
  // Render logic
  const src = APP_LOGOS[id]
  const box = size === 'lg' ? 'size-12' : 'size-10'

  if (src) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white',
          box,
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: fixed local brand assets, not content */}
        <img src={src} alt="" className="size-[70%] object-contain" />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-semibold text-foreground',
        box,
        size === 'lg' ? 'text-body' : 'text-caption',
      )}
    >
      {monogram}
    </span>
  )
}
