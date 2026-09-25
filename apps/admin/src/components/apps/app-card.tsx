'use client'

import { ArrowRight, ExternalLink, MoreVertical } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader } from '@commerce/ui/shadcn/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { appIcon } from '@/apps/registry'
import IconBadge from '@/components/layout/icon-badge'
import StatusLabel from '@/components/status/status-label'
import { type AppKind, appsContent as copy } from '@/data/apps'

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
  admin: { icon: string | null; pages: { path: string; navLabel?: string | undefined }[] }
  /** Open-source projects the app is built on, credited on the card. */
  credits: { name: string; url: string; license: string; note?: string | undefined }[]
}

type AppCardProps = {
  app: AppSummary
  busy: boolean
  onInstall: (app: AppSummary) => void
  onUninstall: (app: AppSummary) => void
}

const KINDS = Object.keys(copy.kinds) as AppKind[]

/** Kinds this plugin contributes to, in settings-page order. */
function providedKinds(app: AppSummary): AppKind[] {
  return KINDS.filter((k) => app.provides[k].length > 0)
}

/** Whether the app has its own admin screens (Open) or is a plain provider (Set up). */
function hasScreens(app: AppSummary): boolean {
  return app.admin.pages.length > 0
}

function categoryLabel(category: string | null): string | null {
  if (!category) return null
  return copy.gallery.categories[category] ?? copy.gallery.categoryFallback(category)
}

/** One app in the gallery grid: icon, name, plain description, category chip, credit line. */
export default function AppCard({ app, busy, onInstall, onUninstall }: AppCardProps) {
  const Icon = appIcon(app.admin.icon)
  const kinds = providedKinds(app)
  const category = categoryLabel(app.category)
  const isConnection = app.kind === 'connection'
  const openHref = hasScreens(app) ? `/apps/${app.id}` : kinds[0] ? copy.kinds[kinds[0]].href : null
  const statusTone = isConnection
    ? app.connected
      ? 'success'
      : 'neutral'
    : app.installed
      ? 'success'
      : 'neutral'

  return (
    <Card className="h-full transition-shadow duration-200 ease-out hover:shadow-card-hover motion-reduce:transition-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconBadge icon={Icon} tone={statusTone} />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-card-title text-ink-strong">{app.name}</span>
              <span className="text-caption text-muted-foreground-soft">
                {copy.version(app.version)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {isConnection ? (
                <StatusLabel
                  kind="app"
                  value={app.connected ? 'connected' : 'notConnected'}
                  variant="pill"
                  size="sm"
                />
              ) : app.installed ? (
                <StatusLabel kind="app" value="installed" variant="pill" size="sm" />
              ) : null}
              {category ? (
                <Badge variant="secondary" className="text-caption">
                  {category}
                </Badge>
              ) : null}
            </div>
            <span className="text-caption text-muted-foreground-soft">
              {isConnection && app.company ? copy.byCompany(app.company) : copy.builtByPlatform}
            </span>
          </div>
        </div>
        {app.installed ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={copy.gallery.kebabLabel(app.name)}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreVertical className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem variant="destructive" onClick={() => onUninstall(app)}>
                {copy.uninstall}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {app.description ? (
          <p className="text-body text-muted-foreground">{app.description}</p>
        ) : null}
        {app.credits.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
            <span>{copy.builtWith}</span>
            {app.credits.map((c) => (
              <a
                key={c.url}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                title={c.note}
                className="inline-flex items-center gap-1 font-medium text-ink-strong underline-offset-4 hover:text-primary hover:underline"
              >
                {copy.creditLabel(c.name, c.license)}
                <ExternalLink className="size-3" />
              </a>
            ))}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          {app.installed && openHref ? (
            <Link
              href={openHref}
              className="inline-flex items-center gap-1 text-body font-medium text-ink-strong underline-offset-4 hover:text-primary hover:underline"
            >
              {hasScreens(app)
                ? copy.open
                : copy.configure(copy.kinds[kinds[0] ?? 'payments'].label)}
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <span />
          )}
          {app.installed ? null : (
            <Button type="button" disabled={busy} onClick={() => onInstall(app)}>
              {busy ? <Spinner /> : null}
              {copy.install}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
