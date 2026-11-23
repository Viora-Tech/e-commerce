'use client'

import { errorText } from '@/lib/api-errors'

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
import { CircleAlert, CircleCheck, ExternalLink, RefreshCw } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import SaveErrorAlert from '@/components/approvals/save-error-alert'
import AppLogo from '@/components/apps/app-logo'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import type { ProviderDef } from '@/components/settings/provider-settings-form'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { isForbidden } from '@/lib/forbidden'
import { routes } from '@/lib/routes'
import { useStorageScope } from '@/lib/storage-scope'
import { initialKeySetMode, keySetValues, withEditedKeySet } from './connect-key-sets'
import ConnectModeSwitch, { type ModeSwitch } from './connect-mode-switch'
import LoadFailedState from './load-failed-state'
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
  /** Run "Test connection" on the values on screen. */
  runTest: () => void
  /** When the last test passed in this visit; null before one has. */
  checkedAt: Date | null
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
  /** Cards under the form that save on their own (a payment app's extra charge). */
  below?: ReactNode
  /** Side cards beside the guide and form (Figma "Delhivery · Connect"): the connection, what it links, help. */
  aside?: ((ctx: ConnectContext<R>) => ReactNode) | undefined
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
  below,
  aside,
}: ProviderConnectPageProps<R>) {
  // Hooks
  const storageScope = useStorageScope()
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
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  /** The settings read failed: say so with Try again instead of a skeleton that never fills. */
  const [loadFailed, setLoadFailed] = useState<'error' | 'no-access' | false>(false)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once per mount (and on Try again), like every settings page
  useEffect(() => {
    setLoadFailed(false)
    loadProviderSettings(kind).then(
      (r) => {
        const stored = mode?.keySets
          ? keySetValues(
              r.settings.providers,
              providerId,
              initialKeySetMode(r.settings.providers, providerId, window.location.search),
              emptyValues,
            )
          : { ...emptyValues, ...(r.settings.providers[providerId] ?? {}) }
        const saved = prepare ? prepare(stored) : stored
        setProvider(r.available.find((p) => p.id === providerId) ?? null)
        setBlob(r.settings)
        setValues(saved)
        setSnapshot(JSON.stringify(saved))
      },
      (err: unknown) => setLoadFailed(isForbidden(err) ? 'no-access' : 'error'),
    )
  }, [attempt])

  // Helpers
  const setField = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (keepTestOn.includes(key)) return
    setTestState({ status: 'idle' })
    setTestedFlag(storageScope, providerId, false)
  }

  // Event handlers
  const handleOpen = () => setOpened(true)

  /** Two key sets (Decentro): show the other mode's saved keys, unedited. */
  const handleKeySet = (next: 'test' | 'live') => {
    if (!blob) return
    const stored = keySetValues(blob.providers, providerId, next, emptyValues)
    const saved = prepare ? prepare(stored) : stored
    setValues(saved)
    setSnapshot(JSON.stringify(saved))
    setTestState({ status: 'idle' })
  }

  const handleTest = async () => {
    setTestState({ status: 'testing' })
    try {
      const result = await test(values)
      if (result.ok) {
        setTestState({ status: 'ok', message: result.message })
        setTestedFlag(storageScope, providerId, true)
        setLastPassed(result)
        setCheckedAt(new Date())
      } else {
        setTestState({ status: 'error', message: result.message })
        // A failed re-test also drops the Overview's "tested" badge.
        setTestedFlag(storageScope, providerId, false)
      }
    } catch (err) {
      setTestState({
        status: 'error',
        message: errorText(err, copy.rateLimited),
      })
    }
  }

  const handleSave = async () => {
    if (!blob) return
    setBusy(true)
    setError(null)
    try {
      const editing = values.mode === 'live' ? 'live' : 'test'
      // The whole blob is sent back, so start from what is saved now: a card on this page that
      // saves on its own (a payment app's extra charge) is not undone by the stale copy.
      const base = (await loadProviderSettings(kind)).settings
      const next: SettingsBlob = mode?.keySets
        ? withEditedKeySet(base, providerId, editing, values)
        : {
            ...base,
            enabled: [...new Set([...base.enabled, providerId])],
            providers: { ...base.providers, [providerId]: values },
          }
      const result = await saveProviderSettings(kind, next)
      const saved =
        mode?.keySets && result
          ? keySetValues(result.providers, providerId, editing, emptyValues)
          : { ...emptyValues, ...(result?.providers[providerId] ?? values) }
      if (result) setBlob(result)
      setValues(saved)
      setSnapshot(JSON.stringify(saved))
      toast.success(copy.saved)
    } catch (err) {
      setError(errorText(err, copy.saveFailed))
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
    runTest: () => void handleTest(),
    checkedAt,
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
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        back={{ label: apps.title, href: routes.apps.page(providerId) }}
        lead={{ kind: 'logo', node: <AppLogo id={providerId} icon={null} size={48} /> }}
        actions={
          <Button
            variant="ghost"
            nativeButton={false}
            render={<a href={siteConfig.urls.docs} target="_blank" rel="noreferrer" />}
          >
            {apps.viewGuide}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Button>
        }
      />
      {error ? <SaveErrorAlert title={copy.saveFailedTitle} message={error} /> : null}

      {loadFailed ? (
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.connection}
          failed={loadFailed}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : loading ? (
        // The page's own columns: the guide beside the form, or the guide over the form with
        // the side cards on the right.
        <div
          aria-busy="true"
          className={
            aside
              ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]'
              : 'grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]'
          }
        >
          {aside ? null : <DataCardSkeleton fields={0} lines={4} />}
          <div className="flex flex-col gap-6">
            {aside ? <DataCardSkeleton fields={0} lines={3} /> : null}
            <DataCardSkeleton fields={3} />
          </div>
          {aside ? <DataCardSkeleton fields={0} lines={3} /> : null}
        </div>
      ) : (
        <div
          className={
            aside
              ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]'
              : 'grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]'
          }
        >
          {aside ? null : guide(ctx)}

          <div className="flex flex-col gap-6">
            {aside ? guide(ctx) : null}
            {connected ? (
              <Alert tone="success">
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
                    providers={blob?.providers ?? {}}
                    onKeySet={handleKeySet}
                  />
                ) : null}

                {fields(ctx)}

                <div className="flex flex-col gap-2">
                  <Button
                    loading={testState.status === 'testing'}
                    type="button"
                    variant="outline"
                    className="w-fit"
                    onClick={handleTest}
                    disabled={testState.status === 'testing' || !canTest(values)}
                  >
                    {/* `loading` draws the spinner in place of the icon. */}
                    <RefreshCw aria-hidden="true" />
                    {copy.testConnection}
                  </Button>
                  {testState.status === 'ok' ? (
                    <p className="flex items-center gap-1.5 text-body font-medium text-success">
                      <CircleCheck aria-hidden="true" className="size-4" />
                      {passedMessage
                        ? passedMessage(testState.message, lastPassed)
                        : testState.message}
                    </p>
                  ) : testState.status === 'error' ? (
                    // Figma "Test connection failed": the reason in a red box under the button.
                    <Alert tone="danger">
                      <CircleAlert />
                      <AlertDescription>{testState.message}</AlertDescription>
                    </Alert>
                  ) : null}
                  <p className="text-caption text-muted-foreground">{copy.testHint}</p>
                </div>

                {extras(ctx)}
              </CardContent>
            </Card>
            {below}
          </div>
          {aside ? aside(ctx) : null}
        </div>
      )}
    </div>
  )
}
