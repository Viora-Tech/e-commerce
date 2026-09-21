import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '../../lib/utils'

const textareaVariants = cva(
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  {
    variants: {
      size: {
        default: 'bg-transparent px-2.5 py-2 text-base md:text-sm dark:bg-input/30',
        /** Form fields (kit): soft fill that clears on focus, 13px. */
        lg: 'bg-muted p-3 text-body focus-visible:bg-card dark:bg-input/30 dark:focus-visible:bg-card',
      },
    },
    defaultVariants: { size: 'default' },
  },
)

function Textarea({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'textarea'> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      data-size={size}
      className={cn(textareaVariants({ size }), className)}
      {...props}
    />
  )
}

export { Textarea, textareaVariants }
