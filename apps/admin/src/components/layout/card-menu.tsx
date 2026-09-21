import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { MoreVertical } from 'lucide-react'
import Link from 'next/link'
import { layoutContent } from '@/data/layout'

export type MenuLink = { label: string; href: string }

type CardMenuProps = { items: readonly MenuLink[]; label?: string }

/** 5:1499: the 20px kebab, backed by a real menu of links. */
export function CardMenu({ items, label = layoutContent.moreActions }: CardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="size-5" aria-hidden="true" />
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
