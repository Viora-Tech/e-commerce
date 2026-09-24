'use client'

import { ArrowRight, ExternalLink, Puzzle } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import StatusLabel from '@/components/status/status-label'
import { type AppKind, appsContent as copy } from '@/data/apps'

export type AppSummary = {
  id: string
  name: string
  version: string
  description: string | null
  builtIn: boolean
  installed: boolean
  provides: Record<AppKind, { id: string; label: string }[]>
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

export default function AppCard({ app, busy, onInstall, onUninstall }: AppCardProps) {
  const kinds = providedKinds(app)

  return (
    <Card className="h-full transition-shadow duration-200 ease-out hover:shadow-card-hover motion-reduce:transition-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Puzzle className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="truncate">{app.name}</CardTitle>
              <span className="text-caption text-muted-foreground-soft">
                {copy.version(app.version)}
              </span>
            </div>
            {app.builtIn ? (
              <StatusLabel kind="app" value="builtIn" variant="pill" size="sm" />
            ) : app.installed ? (
              <StatusLabel kind="app" value="installed" variant="pill" size="sm" />
            ) : null}
          </div>
        </div>
        {app.builtIn ? null : app.installed ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => onUninstall(app)}>
            {busy ? <Spinner /> : null}
            {copy.uninstall}
          </Button>
        ) : (
          <Button type="button" disabled={busy} onClick={() => onInstall(app)}>
            {busy ? <Spinner /> : null}
            {copy.install}
          </Button>
        )}
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
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <Badge key={k} variant="secondary">
              {`${copy.kinds[k].label}: ${app.provides[k].map((p) => p.label).join(', ')}`}
            </Badge>
          ))}
        </div>
        {app.installed ? (
          <div className="mt-auto flex flex-wrap gap-4">
            {kinds.map((k) => (
              <Link
                key={k}
                href={copy.kinds[k].href}
                className="inline-flex items-center gap-1 text-body font-medium text-ink-strong underline-offset-4 hover:text-primary hover:underline"
              >
                {copy.configure(copy.kinds[k].label)}
                <ArrowRight className="size-3.5" />
              </Link>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
