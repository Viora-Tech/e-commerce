'use client'

import { CircleAlert, CircleCheck, CreditCard } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import type { ProviderState } from '@/components/settings/provider-settings-form'
import { decentroAppContent as appCopy } from '@/data/decentro'
import { api } from '@/lib/api-client'
import ConnectAdvancedFields from './connect-advanced-fields'
import ConnectGuide from './connect-guide'

type Blob = ProviderState & Record<string, unknown>
type FieldValues = Record<string, string>
type TestResult = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string }

const copy = appCopy.connect
const PROVIDER_ID = 'decentro'

/** Cosmetic only (the Overview's "tested" badge); cleared whenever the keys change. */
const TESTED_FLAG_KEY = 'decentro-connect-tested'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

const emptyValues: FieldValues = {
  clientId: '',
  clientSecret: '',
  consumerUrn: '',
  mode: 'test',
  flow: 'qr',
  webhookSecret: '',
  payoutConsumerUrn: '',
}

/** Letters and digits only: Decentro refuses special characters in callback header values. */
function newSecret(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const setTestedFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(TESTED_FLAG_KEY, 'true')
    else localStorage.removeItem(TESTED_FLAG_KEY)
  } catch {
    // Blocked storage: the Overview badge just won't show.
  }
}

const filled = (v: string | undefined) => (v ?? '').trim().length > 0

/** The Decentro app's credentials screen: a 3-step guide, Test/Live, a read-only
 *  "Test connection", and the callback and payout settings under Advanced. */
export default function ConnectPage() {
  // Hooks
  const [blob, setBlob] = useState<Blob | null>(null)
  const [values, setValues] = useState<FieldValues>(emptyValues)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openedSignup, setOpenedSignup] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [test, setTest] = useState<TestResult>({ status: 'idle' })

  useEffect(() => {
    api.store.getPayments().then((r) => {
      const stored = { ...emptyValues, ...(r.settings.providers[PROVIDER_ID] ?? {}) }
      // A first visit gets a callback secret ready to copy; it is saved with the keys.
      const saved = stored.webhookSecret ? stored : { ...stored, webhookSecret: newSecret() }
      setBlob(r.settings as Blob)
      setSnapshot(JSON.stringify(saved))
      setValues(saved)
    })
    api.store.current().then((s) => setStoreId(s?.id ?? null))
  }, [])

  // Helpers
  const setField = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (key === 'flow' || key === 'payoutConsumerUrn' || key === 'webhookSecret') return
    setTest({ status: 'idle' })
    setTestedFlag(false)
  }

  // Event handlers
  const handleOpenSignup = () => setOpenedSignup(true)

  const handleModeChange = (next: string[]) => {
    const mode = next[0]
    if (mode) setField('mode', mode)
  }

  const handleNewSecret = () => setField('webhookSecret', newSecret())

  const handleTest = async () => {
    setTest({ status: 'testing' })
    try {
      const result = await api.store.testDecentroConnection({ fields: values })
      setTest({ status: result.ok ? 'ok' : 'error', message: result.message })
      setTestedFlag(result.ok)
    } catch (err) {
      setTest({ status: 'error', message: err instanceof Error ? err.message : copy.rateLimited })
    }
  }

  const handleSave = async () => {
    if (!blob) return
    setBusy(true)
    setError(null)
    try {
      const next: Blob = {
        ...blob,
        enabled: [...new Set([...blob.enabled, PROVIDER_ID])],
        providers: { ...blob.providers, [PROVIDER_ID]: values },
      }
      const result = (await api.store.updatePayments(next)) as Blob | null
      const saved = { ...emptyValues, ...(result?.providers[PROVIDER_ID] ?? values) }
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
  const mode = values.mode === 'live' ? 'live' : 'test'
  const keysFilled =
    filled(values.clientId) && filled(values.clientSecret) && filled(values.consumerUrn)
  const savedValues = snapshot ? (JSON.parse(snapshot) as FieldValues) : emptyValues
  const connected = !!blob?.enabled.includes(PROVIDER_ID) && filled(savedValues.clientId)
  const webhookUrl = `${WORKER_URL}/webhooks/payments/${PROVIDER_ID}/${storeId ?? '<store id>'}`

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
        icon={<CreditCard aria-hidden="true" />}
      />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.saveFailed}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {blob === null ? (
        <Card className="gap-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : (
        <>
          <ConnectGuide
            step1Done={openedSignup || filled(values.clientId)}
            step2Done={keysFilled && test.status === 'ok'}
            step3Done={connected && filled(savedValues.webhookSecret)}
            onOpenSignup={handleOpenSignup}
          />

          <Card size="form">
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <span id="decentro-mode-label" className="text-body font-medium text-foreground">
                  {copy.mode.label}
                </span>
                <ToggleGroup
                  aria-labelledby="decentro-mode-label"
                  value={[mode]}
                  onValueChange={handleModeChange}
                  variant="outline"
                  spacing={0}
                >
                  <ToggleGroupItem value="test">{copy.mode.test}</ToggleGroupItem>
                  <ToggleGroupItem value="live">{copy.mode.live}</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <p className="text-caption text-muted-foreground">{copy.mode.help[mode]}</p>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="decentro-clientId">{copy.fields.clientId.label}</FieldLabel>
                  <Input
                    size="lg"
                    id="decentro-clientId"
                    autoComplete="off"
                    value={values.clientId}
                    onChange={(e) => setField('clientId', e.target.value)}
                  />
                  <FieldDescription>{copy.fields.clientId.help}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="decentro-clientSecret">
                    {copy.fields.clientSecret.label}
                  </FieldLabel>
                  <Input
                    size="lg"
                    id="decentro-clientSecret"
                    type="password"
                    autoComplete="off"
                    value={values.clientSecret}
                    onChange={(e) => setField('clientSecret', e.target.value)}
                  />
                  <FieldDescription>{copy.fields.clientSecret.help}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="decentro-consumerUrn">
                    {copy.fields.consumerUrn.label}
                  </FieldLabel>
                  <Input
                    size="lg"
                    id="decentro-consumerUrn"
                    autoComplete="off"
                    value={values.consumerUrn}
                    onChange={(e) => setField('consumerUrn', e.target.value)}
                  />
                  <FieldDescription>{copy.fields.consumerUrn.help}</FieldDescription>
                </Field>
              </FieldGroup>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={handleTest}
                  disabled={test.status === 'testing' || !keysFilled}
                >
                  {test.status === 'testing' ? <Spinner /> : null}
                  {test.status === 'testing' ? copy.testing : copy.testConnection}
                </Button>
                {test.status === 'ok' ? (
                  <p className="flex items-center gap-1.5 text-body font-medium text-success">
                    <CircleCheck aria-hidden="true" className="size-4" />
                    {test.message}
                  </p>
                ) : test.status === 'error' ? (
                  <p className="flex items-center gap-1.5 text-body font-medium text-destructive">
                    <CircleAlert aria-hidden="true" className="size-4" />
                    {test.message}
                  </p>
                ) : null}
                <p className="text-caption text-muted-foreground">{copy.testHint}</p>
              </div>

              <ConnectAdvancedFields
                flow={values.flow === 'link' ? 'link' : 'qr'}
                webhookSecret={values.webhookSecret ?? ''}
                payoutConsumerUrn={values.payoutConsumerUrn ?? ''}
                webhookUrl={webhookUrl}
                onField={setField}
                onNewSecret={handleNewSecret}
                open={advancedOpen}
                onOpenChange={setAdvancedOpen}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
