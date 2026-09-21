import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { layoutContent } from '@/data/layout'
import type { MenuLink } from './card-menu'

type FilterButtonProps = { label?: string; items: readonly MenuLink[] }

/** 5:2141: 85 x 32 solid green button, 14px label, 20px sort glyph; opens the filter links. */
export function FilterButton({ label = layoutContent.filter, items }: FilterButtonProps) {
  if (items.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-xs text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {label}
        <SlidersHorizontal className="size-5" strokeWidth={1.6} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((it) => (
          <DropdownMenuItem key={it.href} render={<Link href={it.href} />}>
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
