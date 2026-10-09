import { ArrowLeft, Settings } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'
import AppLogo from './app-logo'

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
  path ? routes.apps.page(appId, ...path.split('/')) : routes.apps.page(appId)

/** Small "Built with X (licence)" line under the app description. */
function CreditLine({
  credits,
  copy,
}: {
  credits: AppShellProps['credits']
  copy: typeof appsContent
}) {
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
export default async function AppShell({
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
  const copy = await getCopy(appsContent)
  const section = active.split('/')[0] ?? ''

  return (
    <PageBody>
      <div className="flex flex-col gap-4 border-b border-border pb-0">
        <Link
          href={routes.apps.list()}
          className="flex w-fit items-center gap-1 text-body text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {copy.title}
        </Link>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <AppLogo id={appId} icon={icon} size={72} />
          <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-page-title text-ink-strong">{name}</h1>
              <StatusChip className="h-5 text-xs">{copy.active}</StatusChip>
            </div>
            {description ? (
              <p className="text-caption text-muted-foreground">{description}</p>
            ) : null}
            <CreditLine credits={credits} copy={copy} />
          </div>
          <div className="flex items-center gap-2">
            {hasSettings ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={hrefFor(appId, 'settings')} />}
              >
                <Settings />
                {copy.settings}
              </Button>
            ) : null}
          </div>
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
