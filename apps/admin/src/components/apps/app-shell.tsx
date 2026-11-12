import { siteConfig } from '@commerce/config/site'
import { CircleAlert, TriangleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import NextStepBanner from '@/components/layout/next-step-banner'
import PageBody from '@/components/layout/page-body'
import StatusChip from '@/components/layout/status-chip'
import { CHIP_DOT } from '@/components/status/tone'
import { appsContent } from '@/data/apps'
import { layoutContent } from '@/data/layout'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatAgo } from '@/lib/format-date'
import { routes } from '@/lib/routes'
import AppLogo from './app-logo'
import AppNav from './app-nav'
import AppUninstallButton from './app-uninstall-button'

type AppShellProps = {
  appId: string
  name: string
  icon: string | null
  /** The app's own status pill from its `appBar` read ("GSTIN … · numbering 2026-27"). */
  statusPill?:
    | { label: string; tone: 'neutral' | 'success' | 'attention' | 'danger'; at: Date | null }
    | null
    | undefined
  /** Tabs: manifest pages that carry a nav label. */
  tabs: { path: string; label: string }[]
  /** The manifest path of the page on screen, e.g. `''` or `'invoices/[id]'`. */
  active: string
  /** Whether the app has a `settings` page, for the "…" menu's Settings item. */
  hasSettings: boolean
  /** Connected, Needs setup or Error, as the Installed apps list reads it. */
  status: 'connected' | 'needsSetup' | 'error' | null
  /** The recorded failure behind `error`, in words. */
  problem: string | null
  /** Where to fix a Needs setup or Error app: its Connect page, its settings. */
  fixHref?: string | undefined
  /** The app's one primary action, beside the "…" menu. */
  headerAction?: ReactNode
  children: ReactNode
}

const hrefFor = (appId: string, path: string) =>
  path ? routes.apps.page(appId, ...path.split('/')) : routes.apps.page(appId)

/**
 * An installed app's pages under the compact app bar (Figma App layout v2, 928:10728): the
 * "Apps / <Name>" breadcrumb, a small logo, name and status chip, the app's status pill, its one
 * primary action and the "…" menu (Settings, Uninstall), then a divider. On desktop the app's
 * pages live in the main sidebar under its name; phones keep the in-page menu.
 */
export default async function AppShell({
  appId,
  name,
  icon,
  statusPill,
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
  const layoutCopy = await getCopy(layoutContent)
  const locale = await getLocale()
  const section = active.split('/')[0] ?? ''
  const showNav = tabs.length >= 2
  const tone = status === 'error' ? 'danger' : status === 'needsSetup' ? 'attention' : 'success'
  const statusLabel =
    status === 'error' ? copy.statusError : status === 'needsSetup' ? copy.needsSetup : copy.active
  const pillText = statusPill
    ? statusPill.at
      ? `${statusPill.label} ${formatAgo(statusPill.at, new Date(), locale)}`
      : statusPill.label
    : null

  return (
    <PageBody>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-x-3.5 gap-y-3 border-panel-border border-b pb-4">
          <AppLogo id={appId} icon={icon} size={44} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <nav aria-label={layoutCopy.breadcrumb}>
              <ol className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <li>
                  <Link
                    href={routes.apps.list()}
                    className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {copy.title}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="truncate">
                  {name}
                </li>
              </ol>
            </nav>
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-[1.25rem] leading-6.5 font-semibold text-ink-strong">
                {name}
              </h1>
              <StatusChip tone={tone} className="h-5 shrink-0 text-xs">
                {statusLabel}
              </StatusChip>
            </div>
          </div>
          <div className="flex max-w-full min-w-0 items-center gap-3.5">
            {pillText && statusPill ? (
              <span
                title={pillText}
                className="flex h-7.5 max-w-[22rem] min-w-0 items-center gap-1.5 rounded-full border border-hairline px-2.5 text-caption text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className={cn('size-2 shrink-0 rounded-full', CHIP_DOT[statusPill.tone])}
                />
                <span className="truncate">{pillText}</span>
              </span>
            ) : null}
            {headerAction}
            <AppUninstallButton
              appId={appId}
              name={name}
              settingsHref={hasSettings ? hrefFor(appId, 'settings') : undefined}
            />
          </div>
        </header>
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
        {showNav ? (
          // Desktop: the app's pages live in the main sidebar under its name; the in-page menu
          // stays for phones, where the sidebar is closed.
          <div className="md:hidden">
            <AppNav
              label={name}
              tabs={tabs.map((t) => ({
                href: hrefFor(appId, t.path),
                label: t.label,
                active: t.path === section,
              }))}
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
      </div>
    </PageBody>
  )
}
