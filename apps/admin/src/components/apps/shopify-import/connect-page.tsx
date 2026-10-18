'use client'

import {
  IMPORT_RESOURCES,
  type ImportResource,
  type PreflightCheck,
  REQUIRED_SCOPES,
} from '@commerce/plugin-shopify-import/client'
import { Button } from '@commerce/ui/shadcn/button'
import { CardContent } from '@commerce/ui/shadcn/card'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConnectForm from './connect-form'
import PreflightCard from './preflight-card'
import ScopesCard from './scopes-card'

type Connection = Awaited<ReturnType<typeof api.shopifyImport.connection>>

const base = shopifyImportContent.base

/** Connect with a custom-app token, then choose what to bring over. */
export default function ConnectPage() {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const resources = useCopy(shopifyImportContent.resources)
  const fmt = useFormat()
  const router = useRouter()
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={busy}
          >
            {copy.disconnect}
          </Button>
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
                {copy.scope(REQUIRED_SCOPES[resource])}
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
          {busy ? <Spinner /> : null}
          {copy.preview}
        </Button>
      </div>
    </div>
  )
}
