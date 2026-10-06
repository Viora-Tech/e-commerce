import { InfoIcon, Settings } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { appIcon } from '@/apps/registry'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { appsContent as copy } from '@/data/apps'

type AppShellProps = {
  appId: string
  name: string
  icon: string | null
  description: string | null
  credits: { name: string; url: string; license: string; note?: string | undefined }[]
  /** Tabs: manifest pages that carry a nav label. */
  tabs: { path: string; label: string }[]
  /** The manifest path of the page on screen, e.g. `''` or `'invoices/[id]'`. */
  active: string
  /** Whether one of the app's own pages is a `settings` page, for the header shortcut. */
  hasSettings: boolean
  children: ReactNode
}

const hrefFor = (appId: string, path: string) =>
  path ? `/apps/${appId}/${path}` : `/apps/${appId}`

/** Small "Built with X (licence)" line under the app description. */
function CreditLine({ credits }: { credits: AppShellProps['credits'] }) {
  if (credits.length === 0) return null
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-muted-foreground">
      <span>{copy.builtWith}</span>
      {credits.map((c) => (
        <a
          key={c.url}
          href={c.url}
          target="_blank"
          rel="noreferrer"
          title={c.note}
          className="font-medium text-ink-strong underline-offset-4 hover:text-primary hover:underline"
        >
          {copy.creditLabel(c.name, c.license)}
        </a>
      ))}
    </p>
  )
}

/** Header for an installed app's pages: the premium PageHeader, then its own tabs. */
export default function AppShell({
  appId,
  name,
  icon,
  description,
  credits,
  tabs,
  active,
  hasSettings,
  children,
}: AppShellProps) {
  // Render logic
  const Icon = appIcon(icon)
  const section = active.split('/')[0] ?? ''

  return (
    <PageBody>
      <div className="flex flex-col gap-4 border-b border-border pb-0">
        <PageHeader
          title={name}
          subtitle={
            <span className="flex flex-col gap-1">
              {description ? <span>{description}</span> : null}
              <CreditLine credits={credits} />
            </span>
          }
          icon={<Icon className="size-4" />}
          actions={
            <>
              {hasSettings ? (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={hrefFor(appId, 'settings')} />}
                >
                  <Settings />
                  Settings
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/apps" />}
                aria-label="Help with this app"
              >
                <InfoIcon />
                Help
              </Button>
            </>
          }
        />
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
