import { Input as InputPrimitive } from '@base-ui/react/input'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '../../lib/utils'

const LG =
  'h-9 bg-input-surface hover:border-border-strong px-3 py-2 text-body text-foreground placeholder:text-muted-foreground'

const inputVariants = cva(
  'w-full min-w-0 rounded-md border border-input shadow-input transition-[color,border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  {
    variants: {
      size: {
        /** Same height as Select and Button (h-9, 2.25rem) so a form row or filter bar lines up. */
        default: 'h-9 bg-input-surface px-2.5 py-1 text-base md:text-sm',
        /** Dense rows that sit next to `size="sm"` buttons or selects (h-8, 2rem). */
        sm: 'h-8 bg-input-surface px-2.5 py-1 text-base md:text-sm',
        /** Frame 5:5495 "Outline Input Field" at Shopify density: h-9, Neutal/50 fill, Neutal/200 hairline, 0.8125rem/500 value. */
        lg: LG,
        /** Old kit size; an alias of `lg` kept so existing callers keep working. */
        kit: LG,
      },
    },
    defaultVariants: { size: 'default' },
  },
)

function Input({
  className,
  type,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'input'>, 'size'> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
