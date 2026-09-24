import { Input as InputPrimitive } from '@base-ui/react/input'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '../../lib/utils'

const inputVariants = cva(
  'w-full min-w-0 rounded-md border border-input transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  {
    variants: {
      size: {
        default: 'h-8 bg-transparent px-2.5 py-1 text-base md:text-sm dark:bg-input/30',
        /** Frame 5:5495 "Outline Input Field" at Shopify density: h-9, Neutal/50 fill, Neutal/200 hairline, 0.8125rem/500 value. */
        lg: 'h-9 bg-card hover:border-border-strong px-3 py-2 text-body text-foreground focus-visible:bg-card dark:bg-input/30 dark:focus-visible:bg-card',
        /** Kit sheet 14:1638 "Outline Input Field" at frame size: h-12, Neutal/50 fill, Neutal/200 hairline, 12px inset, 15/700 value. */
        kit: 'h-9 bg-card hover:border-border-strong px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:bg-card dark:bg-input/30 dark:focus-visible:bg-card',
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
