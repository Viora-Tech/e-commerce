import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Spinner } from './spinner'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-sm border border-transparent bg-clip-padding text-body font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-(--duration-press) ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 not-disabled:not-aria-disabled:not-aria-[haspopup]:active:scale-(--motion-press-scale) disabled:pointer-events-none disabled:opacity-45 data-loading:pointer-events-none data-loading:disabled:opacity-85 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* key-primary: the ONE main action per screen (gradient, top highlight, bottom lip, glow). */
        default: 'key-primary',
        /* key-neutral: important header actions that are not the primary. */
        'key-neutral': 'key-neutral',
        /* plain-outline: everything else that needs a rim. */
        /* plain-outline: everything else that needs a rim. Figma depth/button-outline. */
        outline: 'key-neutral aria-expanded:bg-muted aria-expanded:text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        /* plain-ghost: no rim until hovered. */
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground active:bg-muted',
        destructive:
          'key-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        /* Shopify density: h-8 with text-xs/500 (layout per frame 5:5486). */
        default:
          'h-9 gap-2 rounded-sm px-4 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        xs: "h-7 gap-1 rounded-sm px-2 text-xs font-medium in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        /* Frame 5:2562 tab/pill: h-7, 0.375rem radius. */
        sm: 'h-8 gap-1.5 rounded-sm px-3 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        /* Figma Button lg: h-10, 24px sides, 16px glyph. */
        lg: 'h-10 gap-2 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5',
        /* Frame 5:2576 icon button at Shopify density: size-8, 0.25rem radius, size-4 glyph. */
        icon: "size-9 rounded-sm [&_svg:not([class*='size-'])]:size-4",
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8 rounded-sm in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-10',
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
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading ? '' : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
