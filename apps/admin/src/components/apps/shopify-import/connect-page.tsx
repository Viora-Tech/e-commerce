'use client'

import {
  IMPORT_RESOURCES,
  type ImportResource,
  type PreflightCheck,
  RESOURCE_SCOPES,
} from '@commerce/plugin-shopify-import/client'
import { Eye } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { CardContent } from '@commerce/ui/shadcn/card'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { shopifyAppInstallContent } from '@/data/shopify-app-install'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConnectForm from './connect-form'
import PreflightCard from './preflight-card'
import ScopesCard from './scopes-card'

type Connection = Awaited<ReturnType<typeof api.shopifyImport.connection>>

const base = shopifyImportContent.base

/**
 * Connect with a custom-app token, then choose what to bring over. `?edit=1` (the header's
 * "Edit connection", or Change on the card) shows the connect form again over a saved
 * connection; connecting there replaces it.
 */
export default function ConnectPage() {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const installCopy = useCopy(shopifyAppInstallContent)
  const resources = useCopy(shopifyImportContent.resources)
  const fmt = useFormat()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connection, setConnection] = useState<Connection | undefined>(undefined)
  const [chosen, setChosen] = useState<ImportResource[]>([...IMPORT_RESOURCES])
  const [busy, setBusy] = useState(false)
  const [includeUnused, setIncludeUnused] = useState(false)
  const [checks, setChecks] = useState<PreflightCheck[]>([])

  useEffect(() => {
    api.shopifyImport
      .connection()
      .then(setConnection)
      .catch(() => setConnection(null))
  }, [])

  // Back from installing the Koomerce app on Shopify (`?connect=` from the OAuth callback).
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('connect')
    if (result === 'connected') toast.success(installCopy.result.connected)
    else if (result === 'failed') toast.error(installCopy.result.failed)
    else if (result === 'cancelled') toast(installCopy.result.cancelled)
    if (result) router.replace(`${base}/connect`)
  }, [installCopy, router])

  // "Before you import" for what is ticked; a missing scope blocks only its own resource.
  useEffect(() => {
    if (!connection || chosen.length === 0) {
      setChecks([])
      return
    }
    let live = true
    api.shopifyImport
      .preflight({ resources: chosen })
      .then((next) => {
        if (live) setChecks(next)
      })
      .catch(() => {
        if (live) setChecks([])
      })
    return () => {
      live = false
    }
  }, [connection, chosen])

  // Event handlers
  const handleToggle = (resource: ImportResource, on: boolean) =>
    setChosen((current) =>
      on
        ? IMPORT_RESOURCES.filter((r) => r === resource || current.includes(r))
        : current.filter((r) => r !== resource),
    )

  const handleDisconnect = async () => {
    setBusy(true)
    try {
      await api.shopifyImport.disconnect()
      setConnection(null)
      toast.success(copy.disconnected)
    } finally {
      setBusy(false)
    }
  }

  const handleChange = () => router.replace(`${base}/connect?edit=1`)

  const handleCancelChange = () => router.replace(`${base}/connect`)

  const handleReconnected = (next: NonNullable<Connection>) => {
    setConnection(next)
    router.replace(`${base}/connect`)
  }

  const handlePreview = async () => {
    setBusy(true)
    try {
      const run = await api.shopifyImport.createApiRun({
        resources: importable,
        includeUnusedFiles: includeUnused && importable.includes('files'),
      })
      router.push(`${base}/runs/${run.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.previewFailed)
      setBusy(false)
    }
  }

  // Early returns
  if (connection === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (connection === null) {
    return <ConnectForm onConnected={setConnection} />
  }
  if (searchParams.get('edit') === '1') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-body text-muted-foreground">{copy.changeIntro}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleCancelChange}>
            {copy.cancelChange}
          </Button>
        </div>
        <ConnectForm onConnected={handleReconnected} />
      </div>
    )
  }

  // Render logic
  const blocked = new Set(
    checks.flatMap((c) => (c.status === 'block' && c.resource ? [c.resource] : [])),
  )
  const stopped = checks.some((c) => c.status === 'block' && !c.resource)
  const importable = chosen.filter((r) => !blocked.has(r))
  const facts: [string, string][] = [
    [
      copy.shop,
      connection.shopName
        ? `${connection.shopName}, ${connection.shopDomain}`
        : connection.shopDomain,
    ],
    [copy.tokenLabel, `${copy.authMode[connection.authMode]} (${connection.tokenHint})`],
    ...(connection.verifiedAt
      ? [[copy.verified, fmt.dateTime(connection.verifiedAt)] as [string, string]]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <DataCard
        title={copy.connection}
        action={
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleChange}>
              {copy.change}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={busy}
            >
              {copy.disconnect}
            </Button>
          </div>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-ink-strong">{value}</dd>
            </div>
          ))}
        </dl>
      </DataCard>
      <ScopesCard />
      <DataCard
        title={copy.chooseHeading}
        action={<p className="text-body text-muted-foreground">{copy.chooseHelp}</p>}
        bodyClassName="grid gap-3 sm:grid-cols-2"
      >
        {IMPORT_RESOURCES.map((resource) => (
          <label key={resource} htmlFor={`resource-${resource}`} className="flex items-start gap-3">
            <Checkbox
              id={`resource-${resource}`}
              className="mt-0.5"
              checked={chosen.includes(resource) && !blocked.has(resource)}
              disabled={blocked.has(resource)}
              onCheckedChange={(v) => handleToggle(resource, Boolean(v))}
            />
            <span className="flex flex-col">
              <span className="font-medium text-ink-strong">{resources[resource]}</span>
              <span className="text-caption text-muted-foreground">
                {/* Plain words, never Shopify's scope handles (#76). */}
                {copy.scope(RESOURCE_SCOPES[resource].map((s) => copy.scopeNames[s]).join(', '))}
              </span>
            </span>
          </label>
        ))}
        {importable.includes('files') ? (
          <CardContent>
            <label htmlFor="include-unused-files" className="flex items-start gap-3">
              <Checkbox
                id="include-unused-files"
                className="mt-0.5"
                checked={includeUnused}
                onCheckedChange={(v) => setIncludeUnused(Boolean(v))}
              />
              <span className="flex flex-col">
                <span className="font-medium text-ink-strong">{copy.unusedFiles}</span>
                <span className="text-caption text-muted-foreground">{copy.unusedFilesHelp}</span>
              </span>
            </label>
          </CardContent>
        ) : null}
      </DataCard>
      <PreflightCard checks={checks} />
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handlePreview}
          disabled={busy || stopped || importable.length === 0}
        >
          {busy ? <Spinner /> : <Eye aria-hidden="true" />}
          {copy.preview}
        </Button>
      </div>
    </div>
  )
}
