import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-body font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-(--duration-press) ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 not-disabled:not-aria-disabled:not-aria-[haspopup]:active:scale-(--motion-press-scale) disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* Solid ink with a soft drop, no light edge: reads as something to press. */
        default:
          'border-action bg-action text-action-foreground shadow-[0_1px_2px_rgb(0_0_0/0.18),0_2px_6px_-2px_rgb(0_0_0/0.16)] hover:bg-action/90',
        /* White on the field hairline; the hairline darkens on hover (Saleor secondary button). */
        outline:
          'border-input bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:border-border-strong hover:bg-muted/60 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        /* Shopify density: h-8 with text-xs/500 (layout per frame 5:5486). */
        default:
          'h-8 gap-1.5 rounded-xl px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs font-medium in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        /* Frame 5:2562 tab/pill: h-7, 0.375rem radius. */
        sm: "h-7 gap-1 rounded-[0.625rem] px-3 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        /* Frame 5:2503 primary action at Shopify density: h-9 with a 1.125rem glyph. */
        lg: "h-9 gap-1.5 pr-3.5 pl-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-[1.125rem]",
        /* Frame 5:2576 icon button at Shopify density: size-8, 0.25rem radius, size-4 glyph. */
        icon: "size-8 rounded-md [&_svg:not([class*='size-'])]:size-4",
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-7 rounded-[0.375rem] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': "size-9 [&_svg:not([class*='size-'])]:size-[1.125rem]",
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
