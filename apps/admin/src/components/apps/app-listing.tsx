'use client'

import { siteConfig } from '@commerce/config/site'
import { CheckIcon, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { permissionLines } from '@/lib/app-permissions'
import { routes } from '@/lib/routes'
import type { AppSummary } from './app-card'
import AppLogo from './app-logo'
import InstallDialog from './install-dialog'

type AppListingProps = { app: AppSummary }

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-border surface-card p-6">
      <h2 className="text-card-title text-ink-strong">{title}</h2>
      {children}
    </section>
  )
}

/** An app's listing (Figma "Apps / App listing"): what it does, what it can access, details, install. */
export default function AppListing({ app }: AppListingProps) {
  // Hooks
  const copy = useCopy(appsContent)
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleInstall = async () => {
    setBusy(true)
    try {
      await api.apps.install({ id: app.id })
      toast.success(copy.installedToast(app.name))
      setAsking(false)
      // The server page now finds the app installed and renders its own screens.
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.actionFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const category = app.category
    ? (copy.gallery.categories[app.category] ?? copy.gallery.categoryFallback(app.category))
    : null
  const maker = app.kind === 'connection' ? (app.company ?? '') : siteConfig.brand.name
  const byline =
    app.kind === 'connection' && app.company
      ? copy.byCompany(app.company)
      : copy.store.builtBy(maker)
  const lines = permissionLines(app, copy)
  const details = [
    { label: copy.listing.version, value: app.version },
    ...(category ? [{ label: copy.listing.category, value: category }] : []),
    { label: copy.listing.madeBy, value: maker },
    {
      label: copy.listing.type,
      value: app.kind === 'connection' ? copy.listing.typeConnection : copy.listing.typeBuiltin,
    },
  ]

  return (
    <>
      <PageHeader
        title={app.name}
        summary={`${byline}${category ? ` · ${category}` : ''}`}
        back={{ label: copy.listing.back, href: routes.apps.list() }}
        lead={{ kind: 'logo', node: <AppLogo id={app.id} icon={app.admin.icon} size={72} /> }}
        badges={<StatusChip className="h-5 text-xs">{copy.version(app.version)}</StatusChip>}
        actions={<Button onClick={() => setAsking(true)}>{copy.install}</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_23.5rem]">
        <div className="flex flex-col gap-6">
          {app.description ? (
            <Card title={copy.listing.whatItDoes}>
              <p className="text-body text-muted-foreground">{app.description}</p>
            </Card>
          ) : null}
          {app.credits.length > 0 ? (
            <Card title={copy.listing.builtOn}>
              <ul className="flex flex-col gap-2">
                {app.credits.map((c) => (
                  <li key={c.url}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-body text-ink-strong hover:text-primary"
                    >
                      {copy.creditLabel(c.name, c.license)}
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
        <div className="flex flex-col gap-6">
          <Card title={copy.listing.access}>
            <ul className="flex flex-col gap-3">
              {lines.map((line) => (
                <li key={line} className="flex items-start gap-2 text-body text-muted-foreground">
                  <CheckIcon
                    className="mt-0.5 size-4 shrink-0 text-foreground"
                    aria-hidden="true"
                  />
                  {line}
                </li>
              ))}
            </ul>
            <p className="rounded-[0.625rem] bg-muted px-3 py-2.5 text-body text-muted-foreground">
              {copy.permissions.nothingElse} {copy.listing.trust}
            </p>
          </Card>
          <Card title={copy.listing.details}>
            <dl className="flex flex-col gap-3">
              {details.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-4 text-body">
                  <dt className="text-muted-foreground">{d.label}</dt>
                  <dd className="text-right text-foreground">{d.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
      <InstallDialog
        app={asking ? app : null}
        busy={busy}
        onConfirm={() => void handleInstall()}
        onCancel={() => setAsking(false)}
      />
    </>
  )
}
