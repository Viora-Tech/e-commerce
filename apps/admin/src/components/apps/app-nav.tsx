import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'

type AppNavProps = {
  /** The app's name, for the landmark label. */
  label: string
  tabs: { href: string; label: string; active: boolean }[]
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* Same rows as the Settings rail: text-only, the active one on the soft sidebar fill. */
const TAB = `flex h-[1.875rem] min-w-0 shrink-0 items-center rounded-[0.5rem] px-3 text-nav whitespace-nowrap text-ink-strong transition-colors hover:bg-muted md:w-full md:pl-5 ${FOCUS}`
const TAB_ACTIVE = 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent'

/**
 * An app's sub-navigation, laid out like the Settings rail: a vertical list on the left from `md`
 * up, a horizontally scrolling row above the page on phones.
 */
export default function AppNav({ label, tabs }: AppNavProps) {
  return (
    <nav
      aria-label={label}
      className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:sticky md:top-6 md:mx-0 md:w-[13.75rem] md:shrink-0 md:flex-col md:self-start md:overflow-visible md:px-0"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? 'page' : undefined}
          className={cn(TAB, t.active && TAB_ACTIVE)}
        >
          <span className="min-w-0 truncate">{t.label}</span>
        </Link>
      ))}
    </nav>
  )
}
