import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { appIcon } from '@/apps/registry'
import PageBody from '@/components/layout/page-body'

type AppShellProps = {
  appId: string
  name: string
  icon: string | null
  /** Tabs: manifest pages that carry a nav label. */
  tabs: { path: string; label: string }[]
  /** The manifest path of the page on screen, e.g. `''` or `'invoices/[id]'`. */
  active: string
  children: ReactNode
}

const hrefFor = (appId: string, path: string) =>
  path ? `/apps/${appId}/${path}` : `/apps/${appId}`

/** Header for an installed app's pages: its icon and name, then its own tabs. */
export default function AppShell({ appId, name, icon, tabs, active, children }: AppShellProps) {
  // Render logic
  const Icon = appIcon(icon)
  const section = active.split('/')[0] ?? ''

  return (
    <PageBody>
      <div className="flex flex-col gap-3 border-b border-border pb-0">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-[0.5rem] bg-secondary text-foreground">
            <Icon className="size-4" />
          </span>
          <span className="text-title font-semibold text-ink-strong">{name}</span>
        </div>
        <nav aria-label={name} className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const on = t.path === section
            return (
              <Link
                key={t.path}
                href={hrefFor(appId, t.path)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'border-b-2 px-3 py-2 text-body whitespace-nowrap transition-colors',
                  on
                    ? 'border-ring font-medium text-ink-strong'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
      </div>
      {children}
    </PageBody>
  )
}
