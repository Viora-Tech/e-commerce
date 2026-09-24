import { cn } from '@commerce/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/*
 * Kit buttons on the Saleor-style scale: primary and secondary are 36px, 6px radius,
 * 13/500 (the ink action fill or a white field hairline); chip and pill are 32px secondaries;
 * add is a 28px ink chip; link and linkSm are underlined text actions.
 */
const kitButton = cva(
  'inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap transition-[background-color,box-shadow,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'h-9 min-w-24 gap-1.5 rounded-md bg-action px-3.5 text-body font-medium text-action-foreground hover:bg-action/85',
        secondary:
          'h-9 min-w-24 gap-1.5 rounded-md border border-input bg-card px-3.5 text-body font-medium text-foreground hover:border-border-strong hover:bg-muted/60',
        chip: 'h-8 gap-1.5 rounded-md border border-input bg-card py-1 pr-3 pl-2 text-body font-medium text-foreground hover:border-border-strong hover:bg-muted/60 [&_svg]:size-4',
        pill: 'h-8 min-w-20 rounded-md border border-input bg-card px-3 py-1 text-body font-medium text-foreground hover:border-border-strong hover:bg-muted/60',
        add: 'h-7 rounded-md bg-action pr-2.5 pl-2 text-caption text-action-foreground hover:bg-action/85 [&_svg]:size-4',
        link: 'h-auto gap-1 text-body font-medium text-foreground underline-offset-4 hover:underline [&_svg]:size-4',
        linkSm: 'h-auto text-caption text-foreground underline-offset-4 hover:underline',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

type KitButtonProps = VariantProps<typeof kitButton> & {
  href?: string
  className?: string
  children: ReactNode
} & Omit<ComponentProps<'button'>, 'className' | 'children'>

/** Kit button; renders a Link when `href` is given. */
export default function KitButton({ variant, href, className, children, ...rest }: KitButtonProps) {
  // Render logic
  const classes = cn(kitButton({ variant }), className)

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  )
}
