'use client'

import {
  SETTINGS_PARTS,
  type SettingsPart,
  type SettingsPartPlan,
  type SettingsPartResult,
  type SettingsPartState,
  type SettingsResultState,
} from '@commerce/plugin-shopify-import/client'
import { PlugConnect, RefreshCw, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { shopifyImportContent } from '@/data/shopify-import'
import { shopifyImportSettingsContent } from '@/data/shopify-import-settings'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SettingsPartCard from './settings-part-card'

type Plan = Awaited<ReturnType<typeof api.shopifyImport.settingsPreview>>
type Variant = 'success' | 'info' | 'neutral' | 'attention' | 'danger'

const base = shopifyImportContent.base

const PLAN_VARIANT: Record<SettingsPartState, Variant> = {
  ready: 'info',
  same: 'neutral',
  access: 'attention',
  failed: 'danger',
}

const RESULT_VARIANT: Record<SettingsResultState, Variant> = {
  done: 'success',
  same: 'neutral',
  access: 'attention',
  failed: 'danger',
  skipped: 'neutral',
}

const chosenFrom = (parts: SettingsPartPlan[]): SettingsPart[] =>
  parts.filter((p) => p.state === 'ready').map((p) => p.part)

/** Shopify importer › Store settings: check what Shopify has, choose parts, import, read the report. */
export default function SettingsPage() {
  // Hooks
  const copy = useCopy(shopifyImportSettingsContent)
  const [connected, setConnected] = useState<boolean | undefined>(undefined)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [results, setResults] = useState<SettingsPartResult[] | null>(null)
  const [chosen, setChosen] = useState<SettingsPart[]>([])
  const [busy, setBusy] = useState<'check' | 'import' | null>(null)

  useEffect(() => {
    let live = true
    const load = async () => {
      const connection = await api.shopifyImport.connection().catch(() => null)
      if (!live) return
      setConnected(connection !== null)
      if (!connection) return
      // The first check runs on its own; Check again runs it after that.
      setBusy('check')
      try {
        const next = await api.shopifyImport.settingsPreview()
        if (!live) return
        setPlan(next)
        setChosen(chosenFrom(next.parts))
      } catch (err) {
        if (live) toast.error(err instanceof Error ? err.message : copy.checkFailed)
      } finally {
        if (live) setBusy(null)
      }
    }
    load().catch(() => {})
    return () => {
      live = false
    }
  }, [copy.checkFailed])

  // Event handlers
  const handleToggle = (part: SettingsPart, on: boolean) =>
    setChosen((current) =>
      on
        ? SETTINGS_PARTS.filter((p) => p === part || current.includes(p))
        : current.filter((p) => p !== part),
    )

  const handleCheck = async () => {
    setBusy('check')
    setResults(null)
    try {
      const next = await api.shopifyImport.settingsPreview()
      setPlan(next)
      setChosen(chosenFrom(next.parts))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.checkFailed)
    } finally {
      setBusy(null)
    }
  }

  const handleImport = async () => {
    setBusy('import')
    try {
      setResults(await api.shopifyImport.importSettings({ parts: chosen }))
      toast.success(copy.imported)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.importFailed)
    } finally {
      setBusy(null)
    }
  }

  // Early returns
  if (connected === undefined) return <Skeleton className="h-64 w-full" />
  if (!connected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-body text-muted-foreground">{copy.notConnected}</p>
          <Button nativeButton={false} render={<Link href={`${base}/connect`} />}>
            <PlugConnect aria-hidden="true" />
            {copy.connect}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Render logic
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex max-w-[44rem] flex-col gap-1">
        <p className="text-body text-muted-foreground">{results ? copy.reportIntro : copy.intro}</p>
        {plan ? (
          <p className="text-caption text-muted-foreground">{copy.comparing(plan.shopName)}</p>
        ) : null}
      </div>
      <Button variant="outline" onClick={handleCheck} disabled={busy !== null}>
        {busy === 'check' ? <Spinner /> : <RefreshCw aria-hidden="true" />}
        {plan ? copy.checkAgain : copy.check}
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {header}
      {results ? (
        <>
          <h2 className="font-semibold text-ink-strong">{copy.reportHeading}</h2>
          {results.map((r) => (
            <SettingsPartCard
              key={r.part}
              part={r.part}
              items={r.items}
              status={{ label: copy.result[r.state], variant: RESULT_VARIANT[r.state] }}
              missingScopes={r.missingScopes}
              error={r.error}
              summary={r.applied ? copy.saved(r.applied) : null}
            />
          ))}
        </>
      ) : plan === null ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <p className="text-body text-muted-foreground">{copy.choose}</p>
          {plan.parts.map((p) => (
            <SettingsPartCard
              key={p.part}
              part={p.part}
              items={p.items}
              status={{ label: copy.state[p.state], variant: PLAN_VARIANT[p.state] }}
              missingScopes={p.missingScopes}
              error={p.error}
              choose={{
                checked: chosen.includes(p.part),
                disabled: p.state !== 'ready' || busy !== null,
                onChange: (on) => handleToggle(p.part, on),
              }}
            />
          ))}
          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={busy !== null || chosen.length === 0}>
              {busy === 'import' ? <Spinner /> : <Upload aria-hidden="true" />}
              {copy.import(chosen.length)}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
