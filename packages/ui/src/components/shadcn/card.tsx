import * as React from 'react'
import { cn } from '../../lib/utils'

/** Spacing a page may set on a Card through props instead of className (same classes, merged after the base). */
const CARD_GAP = { none: 'gap-0', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5' } as const
const CARD_INSET = {
  none: 'p-0',
  4: 'p-4',
  5: 'p-5',
  6: 'p-6',
  'y-none': 'py-0',
  'y-10': 'py-10',
} as const

function Card({
  className,
  size = 'default',
  gap,
  inset,
  ...props
}: React.ComponentProps<'div'> & {
  size?: 'default' | 'sm' | 'form'
  /** Overrides the gap between the card's children: gap-0, gap-3, gap-4 or gap-5. */
  gap?: keyof typeof CARD_GAP
  /** Overrides the padding: p-0, p-4, p-5, p-6, py-0 or py-10. */
  inset?: keyof typeof CARD_INSET
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        /* White surface on a 1px hairline (--shadow-card), 8px radius, 20px padding. Inside a
         [data-layout=sections] panel (detail and list pages) it becomes a flat section:
         no radius or ring, 24px inset, a hairline under it (Saleor Dashboard layout). */
        'group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-lg surface-card py-(--card-spacing) text-body text-card-foreground [--card-spacing:--spacing(5)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 data-[size=form]:[--card-spacing:--spacing(5)] *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg in-data-[layout=sections]:rounded-none in-data-[layout=sections]:border-b in-data-[layout=sections]:border-border in-data-[layout=sections]:bg-none in-data-[layout=sections]:shadow-none in-data-[layout=sections]:[--card-spacing:--spacing(6)]',
        gap && CARD_GAP[gap],
        inset && CARD_INSET[inset],
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-lg px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('cn-font-heading text-card-title group-data-[size=sm]/card:text-sm', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('px-(--card-spacing)', className)} {...props} />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)',
        className,
      )}
      {...props}
    />
  )
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
