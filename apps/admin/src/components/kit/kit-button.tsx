import { cn } from '@commerce/ui/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/*
 * Buttons from the component sheet (14:99):
 *   primary   14:1629 "Upload New": 42 tall, radius 8, Ocean Green, 15/700 white
 *   secondary 14:1631 "Delete": 42 tall, radius 8, Neutral/200 border, 15/700 Neutral/600
 *   chip      14:1708 "Edit": 32 tall, radius 6, Neutral/200 border, 15/400 Neutral/600, 18px glyph
 *   pill      14:363 "Details" / 14:832 "View Insight": 32 tall; kit is a radius-50 indigo outline, ours is a radius-8 neutral secondary (Kuldeep)
 *   add       14:945 "Add": radius 50, Ocean Green, 12/500 white, 16px glyph, 8/12 inset
 *   link      14:864 "All product" / 14:915 "Add New": 14 (or 12) text; ink-strong with hover underline instead of indigo (Kuldeep)
 */
const kitButton = cva(
  'inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap transition-[background-color,box-shadow,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'h-[2.625rem] min-w-30 rounded-lg bg-primary px-2.5 text-kit-button text-primary-foreground shadow-lift hover:bg-primary/90',
        secondary:
          'h-[2.625rem] min-w-30 rounded-lg border border-secondary bg-card px-2.5 text-kit-button text-muted-foreground hover:bg-background',
        chip: 'h-8 gap-2 rounded-md border border-secondary bg-card py-1 pr-3 pl-2 text-kit-cell text-muted-foreground hover:bg-background [&_svg]:size-[1.125rem]',
        pill: 'h-8 min-w-24 rounded-lg border border-border bg-card px-3 py-1 text-kit-label text-ink-strong hover:bg-background',
        add: 'rounded-lg bg-primary py-1.5 pr-3 pl-2 text-kit-chip text-primary-foreground hover:bg-primary/90 [&_svg]:size-4',
        link: 'h-auto gap-1 text-kit-link text-ink-strong underline-offset-4 hover:text-primary hover:underline [&_svg]:size-5',
        linkSm: 'h-auto text-kit-mini text-ink-strong underline-offset-4 hover:text-primary hover:underline',
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
