import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'

type PlatformTabsProps = {
  items: { label: string; href: string; active: boolean }[]
}

/** Underline tabs that are links (a list's state or source), for server-rendered console lists. */
export default function PlatformTabs({ items }: PlatformTabsProps) {
  return (
    <nav className="no-scrollbar flex gap-4 overflow-x-auto border-border border-b px-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            '-mb-px shrink-0 border-b-2 py-2.5 text-body transition-[color,border-color]',
            item.active
              ? 'border-foreground font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
