import { cn } from '@commerce/ui/lib/utils'
import { courierInitials } from './courier-groups'
import { courierLogoSrc } from './courier-logo'

type CourierMarkProps = {
  /** The row's label ("Delhivery Surface", "Xpressbees via Shiprocket"). */
  label: string
  className?: string | undefined
}

/** The carrier's logo tile (Figma 898:7790, 908:8804), or its initials when there is no logo. */
export default function CourierMark({ label, className }: CourierMarkProps) {
  // Render logic
  const logo = courierLogoSrc(label)

  return logo ? (
    <span
      aria-hidden
      className={cn(
        'flex h-8 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md',
        logo.light && 'bg-white px-1',
        className,
      )}
    >
      {/* biome-ignore lint/performance/noImgElement: a small static logo from /public. */}
      <img src={logo.src} alt="" className="max-h-7 max-w-full object-contain" />
    </span>
  ) : (
    <span
      aria-hidden
      className={cn(
        'flex h-8 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-caption font-semibold text-ink-strong',
        className,
      )}
    >
      {courierInitials(label)}
    </span>
  )
}
