import { siteConfig } from '@commerce/config/site'
import { CircleAlert, Settings, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import NextStepBanner from '@/components/layout/next-step-banner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
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
  /** Connected, Needs setup or Error, as the Installed apps list reads it. */
  status: 'connected' | 'needsSetup' | 'error' | null
  /** The recorded failure behind `error`, in words. */
  problem: string | null
  /** Where to fix a Needs setup or Error app: its Connect page, its settings. */
  fixHref?: string | undefined
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
  status,
  problem,
  fixHref,
  headerAction,
  children,
}: AppShellProps) {
  // Render logic
  const copy = await getCopy(appsContent)
  const section = active.split('/')[0] ?? ''
  const tone = status === 'error' ? 'danger' : status === 'needsSetup' ? 'attention' : 'success'
  const statusLabel =
    status === 'error' ? copy.statusError : status === 'needsSetup' ? copy.needsSetup : copy.active

  return (
    <PageBody>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={name}
          back={{ label: copy.title, href: routes.apps.list() }}
          lead={{ kind: 'logo', node: <AppLogo id={appId} icon={icon} size={72} /> }}
          badges={
            <StatusChip tone={tone} className="h-5 text-xs">
              {statusLabel}
            </StatusChip>
          }
          subtitle={
            <div className="flex flex-col gap-1">
              {description ? <p>{description}</p> : null}
              <CreditLine credits={credits} copy={copy} />
            </div>
          }
          actions={
            <>
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
            </>
          }
        />
        {status === 'needsSetup' || status === 'error' ? (
          // Figma "WhatsApp · Needs setup": the raised card with what is wrong and the way out.
          <NextStepBanner
            tone="attention"
            eyebrow={status === 'error' ? copy.errorBanner.eyebrow : copy.setupBanner.eyebrow}
            title={status === 'error' ? copy.errorBanner.title : copy.setupBanner.title}
            body={status === 'error' ? problem : copy.setupBanner.body}
            icon={status === 'error' ? <CircleAlert /> : <TriangleAlert />}
            actions={
              <>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<a href={siteConfig.urls.docs} target="_blank" rel="noreferrer" />}
                >
                  {copy.viewGuide}
                </Button>
                {fixHref ? (
                  <Button nativeButton={false} render={<Link href={fixHref} />}>
                    {status === 'error'
                      ? problem && /run it again/i.test(problem)
                        ? copy.errorBanner.runAgain
                        : copy.errorBanner.action
                      : copy.setupBanner.action}
                  </Button>
                ) : null}
              </>
            }
          />
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
