import { ArrowLeft, CircleAlert, Settings } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'
import AppLogo from './app-logo'
import AppNav from './app-nav'
import AppUninstallButton from './app-uninstall-button'

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
  /** A connection that is installed but has no working credentials yet; links to where to fix it. */
  setupHref?: string | undefined
  /** The app's own header button, shown beside the more menu. */
  headerAction?: ReactNode
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
  setupHref,
  headerAction,
  children,
}: AppShellProps) {
  // Render logic
  const copy = await getCopy(appsContent)
  const section = active.split('/')[0] ?? ''

  return (
    <PageBody>
      <div className="flex flex-col gap-4">
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
              <StatusChip tone={setupHref ? 'attention' : 'neutral'} className="h-5 text-xs">
                {setupHref ? copy.needsSetup : copy.active}
              </StatusChip>
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
            {headerAction}
            <AppUninstallButton appId={appId} name={name} />
          </div>
        </div>
        {setupHref ? (
          <Alert>
            <CircleAlert />
            <AlertTitle>{copy.setupBanner.title}</AlertTitle>
            <AlertDescription>
              {copy.setupBanner.body}{' '}
              <Link href={setupHref} className="font-medium underline">
                {copy.setupBanner.action}
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
        {tabs.length > 1 ? (
          <AppNav
            label={name}
            tabs={tabs.map((t) => ({
              href: hrefFor(appId, t.path),
              label: t.label,
              active: t.path === section,
            }))}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
      </div>
    </PageBody>
  )
}
