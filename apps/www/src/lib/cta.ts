import { cn } from '@commerce/ui/lib/utils'

type CtaSize = 'sm' | 'md' | 'lg'

const SIZES: Record<CtaSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-11 px-6 text-base',
}

/** The one orange button style: primary CTAs only (docs: orange appears nowhere else). */
export function ctaClass(size: CtaSize = 'md', className?: string): string {
  return cn(
    'sheen inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-cta font-semibold whitespace-nowrap text-cta-foreground transition-[background-color,scale,opacity] duration-(--duration-press) ease-out outline-none hover:bg-cta-light focus-visible:ring-3 focus-visible:ring-cta/50 active:scale-(--motion-press-scale) disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0',
    SIZES[size],
    className,
  )
}
