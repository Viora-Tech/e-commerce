import { cn } from '@commerce/ui/lib/utils'

type GatewayLogoProps = {
  monogram: string
  size?: 'sm' | 'lg'
}

/** A letter tile standing in for a payment company's logo; we don't ship their marks. */
export default function GatewayLogo({ monogram, size = 'sm' }: GatewayLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-semibold text-foreground',
        size === 'lg' ? 'size-12 text-body' : 'size-10 text-caption',
      )}
    >
      {monogram}
    </span>
  )
}
