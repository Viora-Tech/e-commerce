import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import Reveal from '../common/reveal'

type BentoTileProps = {
  children: ReactNode
  eyebrow: string
  title: string
  body: string
  className?: string
  /** Where the copy block sits relative to the art: below it, or beside it. */
  layout?: 'stack' | 'side'
  step?: number
}

/** One card of the "Built for how India buys" grid: art on top, copy underneath. */
export default function BentoTile({
  children,
  eyebrow,
  title,
  body,
  className,
  layout = 'stack',
  step = 0,
}: BentoTileProps) {
  return (
    <Reveal
      as="article"
      step={step}
      spotlight
      tilt={2}
      className={cn(
        'surface-card group relative flex gap-6 overflow-hidden rounded-3xl p-7',
        layout === 'stack' ? 'flex-col' : 'flex-col md:flex-row md:items-stretch',
        className,
      )}
    >
      <div className={cn('flex flex-1 flex-col', layout === 'side' && 'md:order-2')}>
        {children}
      </div>
      <div
        className={cn(
          'mt-auto flex flex-col gap-2',
          layout === 'side' && 'md:order-1 md:w-72 md:justify-end',
        )}
      >
        <p className="text-eyebrow">{eyebrow}</p>
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </Reveal>
  )
}
