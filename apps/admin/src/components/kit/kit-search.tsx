'use client'

import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ComponentProps } from 'react'

type KitSearchProps = Omit<ComponentProps<'input'>, 'size' | 'className'> & {
  /** `card` = 14:865 (36 tall, 20px glyph left); `toolbar` = 14:988 (40 tall, 264 wide, 24px glyph right). */
  size?: 'card' | 'toolbar'
  className?: string
}

const SIZE = {
  card: 'h-9 gap-2 p-2 text-kit-body [&_svg]:size-5',
  toolbar: 'h-10 w-66 gap-1.5 py-1.5 pr-2 pl-3 text-kit-body [&_svg]:size-6',
} as const

/** Kit search field: Neutral/50 fill, radius 8, no border, muted placeholder and glyph. */
export default function KitSearch({ size = 'card', className, ...rest }: KitSearchProps) {
  // Render logic
  const glyph = <Search className="shrink-0 text-muted-foreground" aria-hidden="true" />

  return (
    <label
      className={cn(
        'flex items-center rounded-lg bg-background text-muted-foreground focus-within:ring-2 focus-within:ring-ring',
        SIZE[size],
        className,
      )}
    >
      {size === 'card' ? glyph : null}
      <input
        type="search"
        className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        {...rest}
      />
      {size === 'toolbar' ? glyph : null}
    </label>
  )
}
