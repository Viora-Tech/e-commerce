'use client'

import { siteConfig } from '@commerce/config/site'
import { MoreVertical, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { type AppKind, appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import AppLogo from './app-logo'

export type AppSummary = {
  id: string
  name: string
  version: string
  description: string | null
  category: string | null
  builtIn: boolean
  /** `builtin`: made by us, no outside account. `connection`: links to another company's service. */
  kind: 'builtin' | 'connection'
  /** The outside company behind a `connection` plugin, e.g. `Cloudflare`. Null for `builtin`. */
  company: string | null
  installed: boolean
  /** For a `connection`: installed AND the merchant has saved working credentials for it. */
  connected: boolean
  provides: Record<AppKind, { id: string; label: string }[]>
  /** Lifecycle events the app subscribes to (shown on the permission step). */
  hooks: string[]
  productFields: unknown[]
  admin: { icon: string | null; pages: { path: string; navLabel?: string | undefined }[] }
  /** Open-source projects the app is built on, credited on the card. */
  credits: { name: string; url: string; license: string; note?: string | undefined }[]
}

type AppCardProps = {
  app: AppSummary
  /** `installed`: status, Open and a menu. `store`: description and Install. */
  variant: 'installed' | 'store'
  busy: boolean
  onInstall: (app: AppSummary) => void
  onUninstall: (app: AppSummary) => void
}

const KINDS = Object.keys(appsContent.kinds) as AppKind[]

/** Kinds this plugin contributes to, in settings-page order. */
function providedKinds(app: AppSummary): AppKind[] {
  return KINDS.filter((k) => app.provides[k].length > 0)
}

/** Whether a connection is installed but still has no working credentials. */
export function needsSetup(app: AppSummary): boolean {
  return app.installed && app.kind === 'connection' && !app.connected
}

/** One app in the gallery: the installed card (Open, menu) or the store card (Install). */
export default function AppCard({ app, variant, busy, onInstall, onUninstall }: AppCardProps) {
  // Hooks
  const copy = useCopy(appsContent)

  // Render logic
  const kinds = providedKinds(app)
  const firstKind = kinds[0]
  const hasScreens = app.admin.pages.length > 0
  const openHref = hasScreens
    ? routes.apps.page(app.id)
    : firstKind
      ? copy.kinds[firstKind].href
      : null
  const byline =
    app.kind === 'connection' && app.company
      ? copy.byCompany(app.company)
      : copy.store.builtBy(siteConfig.brand.name)
  const openLabel = hasScreens
    ? copy.open
    : copy.configure(copy.kinds[firstKind ?? 'payments'].label)
  const attention = needsSetup(app)

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-[1.125rem] shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover motion-reduce:transition-none">
      <div className="flex items-center gap-3">
        <AppLogo id={app.id} icon={app.admin.icon} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={routes.apps.page(app.id)}
            className="truncate text-[0.9375rem] leading-[1.375rem] font-semibold text-foreground hover:text-primary"
          >
            {app.name}
          </Link>
          <span className="truncate text-xs text-muted-foreground">{byline}</span>
        </div>
      </div>
      {variant === 'installed' ? (
        <StatusChip tone={attention ? 'attention' : 'neutral'} className="h-5 self-start text-xs">
          {attention ? copy.needsSetup : copy.active}
        </StatusChip>
      ) : null}
      {app.description ? (
        <p className="text-body text-muted-foreground">{app.description}</p>
      ) : null}
      <div className="mt-auto flex items-center gap-2 pt-1">
        {variant === 'installed' ? (
          <>
            {openHref ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={attention && firstKind ? copy.kinds[firstKind].href : openHref} />
                }
              >
                {attention ? copy.needsSetup : openLabel}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={copy.gallery.kebabLabel(app.name)}
                className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-[0.625rem] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem variant="destructive" onClick={() => onUninstall(app)}>
                  {copy.uninstall}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button variant="outline" loading={busy} onClick={() => onInstall(app)}>
            <Plus />
            {copy.install}
          </Button>
        )}
      </div>
    </div>
  )
}
