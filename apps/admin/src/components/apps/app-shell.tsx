import { siteConfig } from '@commerce/config/site'
import { CircleAlert, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import NextStepBanner from '@/components/layout/next-step-banner'
import PageBody from '@/components/layout/page-body'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatAgo } from '@/lib/format-date'
import { routes } from '@/lib/routes'
import AppNav from './app-nav'
import AppShellActions from './app-shell-actions'
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
 * An installed app's pages under one slim row: the app's status pill, its one primary action and
 * the "…" menu (Settings, Uninstall). No title row: the sidebar names the open app. On
 * desktop the app's pages live in the main sidebar under its row; phones keep the in-page menu.
 */
export default async function AppShell({
  appId,
  name,
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
  const locale = await getLocale()
  const section = active.split('/')[0] ?? ''
  const showNav = tabs.length >= 2
  const pillText = statusPill
    ? statusPill.at
      ? `${statusPill.label} ${formatAgo(statusPill.at, new Date(), locale)}`
      : statusPill.label
    : null

  return (
    <PageBody>
      {/* No app title row and no gap (owner, 25 Nov 2026): the sidebar names the open app and
          each page has its own title. The app's status pill, action and "…" menu float top right;
          only the first heading leaves room for them (AppShellActions), so tables and cards keep
          the page's full width like Orders (owner, 26 Nov 2026). */}
      <div className="relative flex flex-col gap-5">
        <AppShellActions>
          {pillText && statusPill ? (
            <span title={pillText} className="flex max-w-[22rem] min-w-0">
              <StatusChip tone={statusPill.tone} variant="outline" className="min-w-0">
                <span className="truncate">{pillText}</span>
              </StatusChip>
            </span>
          ) : null}
          {headerAction}
          <AppUninstallButton
            appId={appId}
            name={name}
            settingsHref={hasSettings ? hrefFor(appId, 'settings') : undefined}
          />
        </AppShellActions>
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
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
          {showNav ? (
            // Desktop: the open app's pages sit under its row in the main sidebar (owner, 14 Nov
            // 2026); the in-page menu is for phones only, where the sidebar is closed.
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
      </div>
    </PageBody>
  )
}
