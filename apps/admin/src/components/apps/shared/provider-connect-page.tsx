'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: ProviderConnectPage, ConnectContext, ConnectPageCopy, TestOutcome
 * WHAT:  a provider app's Connect page (`/apps/<id>/connect`): save bar, guide, optional Test/Live
 *        switch, the provider's fields, a read-only "Test connection", then the provider's extras.
 * WHY:   one owner instead of four copies (Delhivery, Shiprocket, RapidShyp, Decentro). These save
 *        straight into the store's shipping or payments settings blob with a save bar, unlike the
 *        guided payment-gateway connect (GatewayConnectPage), so they share this shell instead.
 * WHERE: components/apps/{delhivery,shiprocket,rapidshyp,decentro}/connect-page.tsx.
 */

import { siteConfig } from '@commerce/config/site'
import { ArrowLeft, CircleAlert, CircleCheck, ExternalLink } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import AppLogo from '@/components/apps/app-logo'
import SaveBar from '@/components/layout/save-bar'
import type { ProviderDef } from '@/components/settings/provider-settings-form'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import ConnectModeSwitch, { type ModeSwitch } from './connect-mode-switch'
import {
  type FieldValues,
  loadProviderSettings,
  type SettingsBlob,
  type SettingsKind,
  saveProviderSettings,
  setTestedFlag,
} from './provider-settings'

export type TestOutcome = { ok: boolean; message?: string | undefined }

type TestState = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string | undefined }

export type ConnectPageCopy = {
  title: string
  intro: string
  testing: string
  testConnection: string
  testHint: string
  /** Shown when "Test connection" throws (the usual cause is the rate limit). */
  rateLimited: string
  unsaved: string
  saveLabel: string
  discard: string
  saved: string
  /** The error alert's title. */
  saveFailedTitle: string
  /** The error alert's text when the failure carries no message. */
  saveFailed: string
}

/** Everything the provider's guide, fields and extras slots can read. */
export type ConnectContext<R extends TestOutcome> = {
  values: FieldValues
  /** The values as last saved (or loaded). */
  savedValues: FieldValues
  setField: (key: string, value: string) => void
  /** The provider is in the saved enabled list. */
  enabled: boolean
  testStatus: TestState['status']
  /** The last passing test's result; kept when fields change, replaced by the next pass. */
  lastPassed: R | null
  /** The merchant opened the provider's dashboard or sign-up from the guide. */
  opened: boolean
  onOpen: () => void
  advancedOpen: boolean
  onAdvancedOpenChange: (open: boolean) => void
}

type ProviderConnectPageProps<R extends TestOutcome> = {
  providerId: string
  kind: SettingsKind
  /** Kept for the callers; the header now shows the app logo. */
  icon?: ReactNode
  copy: ConnectPageCopy
  emptyValues: FieldValues
  test: (values: FieldValues) => Promise<R>
  /** Keep the skeleton until this deployment lists the provider (couriers), not just until the blob loads. */
  waitForListing?: boolean
  /** Adjust freshly loaded values, e.g. a first-visit secret. The result is the clean snapshot. */
  prepare?: (values: FieldValues) => FieldValues
  /** Fields whose edits do not invalidate a passing test. */
  keepTestOn?: string[]
  /** Extra gate on "Test connection" besides "not already testing". */
  canTest?: (values: FieldValues) => boolean
  mode?: ModeSwitch
  /** The success line under "Test connection"; defaults to the result's message. */
  passedMessage?: (message: string | undefined, lastPassed: R | null) => ReactNode
  guide: (ctx: ConnectContext<R>) => ReactNode
  fields: (ctx: ConnectContext<R>) => ReactNode
  extras: (ctx: ConnectContext<R>) => ReactNode
}

const alwaysTestable = () => true

export default function ProviderConnectPage<R extends TestOutcome>({
  providerId,
  kind,
  copy,
  emptyValues,
  test,
  waitForListing = false,
  prepare,
  keepTestOn = [],
  canTest = alwaysTestable,
  mode,
  passedMessage,
  guide,
  fields,
  extras,
}: ProviderConnectPageProps<R>) {
  // Hooks
  const apps = useCopy(appsContent)
  const [provider, setProvider] = useState<ProviderDef | null>(null)
  const [blob, setBlob] = useState<SettingsBlob | null>(null)
  const [values, setValues] = useState<FieldValues>(emptyValues)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [opened, setOpened] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })
  const [lastPassed, setLastPassed] = useState<R | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once per mount, like every settings page
  useEffect(() => {
    loadProviderSettings(kind).then((r) => {
      const stored = { ...emptyValues, ...(r.settings.providers[providerId] ?? {}) }
      const saved = prepare ? prepare(stored) : stored
      setProvider(r.available.find((p) => p.id === providerId) ?? null)
      setBlob(r.settings)
      setValues(saved)
      setSnapshot(JSON.stringify(saved))
    })
  }, [])

  // Helpers
  const setField = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (keepTestOn.includes(key)) return
    setTestState({ status: 'idle' })
    setTestedFlag(providerId, false)
  }

  // Event handlers
  const handleOpen = () => setOpened(true)

  const handleTest = async () => {
    setTestState({ status: 'testing' })
    try {
      const result = await test(values)
      if (result.ok) {
        setTestState({ status: 'ok', message: result.message })
        setTestedFlag(providerId, true)
        setLastPassed(result)
      } else {
        setTestState({ status: 'error', message: result.message })
      }
    } catch (err) {
      setTestState({
        status: 'error',
        message: err instanceof Error ? err.message : copy.rateLimited,
      })
    }
  }

  const handleSave = async () => {
    if (!blob) return
    setBusy(true)
    setError(null)
    try {
      const next: SettingsBlob = {
        ...blob,
        enabled: [...new Set([...blob.enabled, providerId])],
        providers: { ...blob.providers, [providerId]: values },
      }
      const result = await saveProviderSettings(kind, next)
      const saved = { ...emptyValues, ...(result?.providers[providerId] ?? values) }
      if (result) setBlob(result)
      setValues(saved)
      setSnapshot(JSON.stringify(saved))
      toast.success(copy.saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (snapshot) setValues(JSON.parse(snapshot) as FieldValues)
    setError(null)
  }

  // Render logic
  const dirty = snapshot !== null && JSON.stringify(values) !== snapshot
  const connected = testState.status === 'ok' && !dirty && !!blob?.enabled.includes(providerId)
  const loading = waitForListing ? provider === null : blob === null
  const ctx: ConnectContext<R> = {
    values,
    savedValues: snapshot ? (JSON.parse(snapshot) as FieldValues) : emptyValues,
    setField,
    enabled: !!blob?.enabled.includes(providerId),
    testStatus: testState.status,
    lastPassed,
    opened,
    onOpen: handleOpen,
    advancedOpen,
    onAdvancedOpenChange: setAdvancedOpen,
  }

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.saveLabel}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <Link
        href={routes.apps.page(providerId)}
        className="flex w-fit items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {apps.title}
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <AppLogo id={providerId} icon={null} size={48} />
        <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col">
          <h1 className="text-page-title text-ink-strong">{copy.title}</h1>
          <p className="text-caption text-muted-foreground">{copy.intro}</p>
        </div>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<a href={siteConfig.urls.docs} target="_blank" rel="noreferrer" />}
        >
          {apps.viewGuide}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.saveFailedTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <Card gap={4} inset={6}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {guide(ctx)}

          <div className="flex flex-col gap-6">
            {connected ? (
              <Alert>
                <CircleCheck />
                <AlertTitle>{apps.connectedHeading}</AlertTitle>
                <AlertDescription>
                  {apps.connectedBody}{' '}
                  <Link href={routes.apps.page(providerId)} className="font-medium underline">
                    {apps.openApp}
                  </Link>
                </AlertDescription>
              </Alert>
            ) : null}
            <Card size="form">
              <CardContent className="flex flex-col gap-5">
                {mode ? (
                  <ConnectModeSwitch
                    providerId={providerId}
                    mode={mode}
                    values={values}
                    setField={setField}
                  />
                ) : null}

                {fields(ctx)}

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    onClick={handleTest}
                    disabled={testState.status === 'testing' || !canTest(values)}
                  >
                    {testState.status === 'testing' ? <Spinner /> : null}
                    {testState.status === 'testing' ? copy.testing : copy.testConnection}
                  </Button>
                  {testState.status === 'ok' ? (
                    <p className="flex items-center gap-1.5 text-body font-medium text-success">
                      <CircleCheck aria-hidden="true" className="size-4" />
                      {passedMessage
                        ? passedMessage(testState.message, lastPassed)
                        : testState.message}
                    </p>
                  ) : testState.status === 'error' ? (
                    <p className="flex items-center gap-1.5 text-body font-medium text-destructive">
                      <CircleAlert aria-hidden="true" className="size-4" />
                      {testState.message}
                    </p>
                  ) : null}
                  <p className="text-caption text-muted-foreground">{copy.testHint}</p>
                </div>

                {extras(ctx)}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
