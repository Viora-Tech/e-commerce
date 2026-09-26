'use client'

import { CircleAlert, CircleCheck, Truck } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import type { ProviderDef, ProviderState } from '@/components/settings/provider-settings-form'
import { rapidshypAppContent as appCopy } from '@/data/rapidshyp'
import { api } from '@/lib/api-client'
import ConnectAdvancedFields from './connect-advanced-fields'
import ConnectGuide from './connect-guide'

type Blob = ProviderState & Record<string, unknown>
type FieldValues = Record<string, string>
type TestResult = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string }

const copy = appCopy.connect
const PROVIDER_ID = 'rapidshyp'

/** localStorage flag: only cosmetic (which shows the tested badge on Overview), never trusted for
 *  anything that matters. Cleared whenever the saved credentials change, so it can't go stale. */
const TESTED_FLAG_KEY = 'rapidshyp-connect-tested'

const emptyValues: FieldValues = {
  apiKey: '',
  storeName: '',
  pickupAddressName: '',
  originPincode: '',
  baseUrl: '',
}

const markTested = () => {
  try {
    localStorage.setItem(TESTED_FLAG_KEY, 'true')
  } catch {
    // Private browsing / blocked storage: the Overview badge just won't show. Not fatal.
  }
}

const clearTested = () => {
  try {
    localStorage.removeItem(TESTED_FLAG_KEY)
  } catch {
    // Same as above.
  }
}

/** The RapidShyp app's own credentials screen: a 3-step guide, a read-only "Test connection"
 *  check, and the rarely-touched base URL field under Advanced. */
export default function ConnectPage() {
  // Hooks
  const [provider, setProvider] = useState<ProviderDef | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [values, setValues] = useState<FieldValues>(emptyValues)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openedDashboard, setOpenedDashboard] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [test, setTest] = useState<TestResult>({ status: 'idle' })

  useEffect(() => {
    api.store.getShipping().then((r) => {
      const def = r.available.find((p) => p.id === PROVIDER_ID) ?? null
      const saved = { ...emptyValues, ...(r.settings.providers[PROVIDER_ID] ?? {}) }
      setProvider(def)
      setBlob(r.settings as Blob)
      setValues(saved)
      setSnapshot(JSON.stringify(saved))
    })
  }, [])

  // Helpers
  const setField = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setTest({ status: 'idle' })
    clearTested()
  }

  // Event handlers
  const handleOpenDashboard = () => setOpenedDashboard(true)

  const handleTest = async () => {
    setTest({ status: 'testing' })
    try {
      const result = await api.store.testRapidshypConnection({ fields: values })
      if (result.ok) {
        setTest({ status: 'ok', message: result.message })
        markTested()
      } else {
        setTest({ status: 'error', message: result.message })
      }
    } catch (err) {
      setTest({
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
      const next: Blob = {
        ...blob,
        enabled: [...new Set([...blob.enabled, PROVIDER_ID])],
        providers: { ...blob.providers, [PROVIDER_ID]: values },
      }
      const result = (await api.store.updateShipping(next)) as Blob | null
      const saved = { ...emptyValues, ...(result?.providers[PROVIDER_ID] ?? values) }
      if (result) setBlob(result)
      setValues(saved)
      setSnapshot(JSON.stringify(saved))
      toast.success('Settings saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
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
  const step2Done = (values.apiKey ?? '').trim().length > 0
  const step3Done =
    step2Done &&
    (values.storeName ?? '').trim().length > 0 &&
    (values.pickupAddressName ?? '').trim().length > 0 &&
    /^\d{6}$/.test((values.originPincode ?? '').trim())

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message="Unsaved changes"
        saveLabel="Save and connect"
        discardLabel="Discard"
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader title={copy.title} subtitle={copy.intro} icon={<Truck aria-hidden="true" />} />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {provider === null ? (
        <Card className="gap-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : (
        <>
          <ConnectGuide
            openedDashboard={openedDashboard}
            onOpenDashboard={handleOpenDashboard}
            step2Done={step2Done}
            step3Done={step3Done}
          />

          <Card size="form">
            <CardContent className="flex flex-col gap-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="rapidshyp-apiKey">{copy.fields.apiKey.label}</FieldLabel>
                  <Input
                    size="lg"
                    id="rapidshyp-apiKey"
                    type="password"
                    autoComplete="off"
                    value={values.apiKey}
                    onChange={(e) => setField('apiKey', e.target.value)}
                  />
                  <FieldDescription>{copy.fields.apiKey.help}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="rapidshyp-storeName">
                    {copy.fields.storeName.label}
                  </FieldLabel>
                  <Input
                    size="lg"
                    id="rapidshyp-storeName"
                    autoComplete="off"
                    value={values.storeName}
                    onChange={(e) => setField('storeName', e.target.value)}
                  />
                  <FieldDescription>{copy.fields.storeName.help}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="rapidshyp-pickupAddressName">
                    {copy.fields.pickupAddressName.label}
                  </FieldLabel>
                  <Input
                    size="lg"
                    id="rapidshyp-pickupAddressName"
                    autoComplete="off"
                    value={values.pickupAddressName}
                    onChange={(e) => setField('pickupAddressName', e.target.value)}
                  />
                  <FieldDescription>{copy.fields.pickupAddressName.help}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="rapidshyp-originPincode">
                    {copy.fields.originPincode.label}
                  </FieldLabel>
                  <Input
                    size="lg"
                    id="rapidshyp-originPincode"
                    inputMode="numeric"
                    autoComplete="off"
                    value={values.originPincode}
                    onChange={(e) => setField('originPincode', e.target.value)}
                  />
                  <FieldDescription>{copy.fields.originPincode.help}</FieldDescription>
                </Field>
              </FieldGroup>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={handleTest}
                  disabled={test.status === 'testing'}
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
                baseUrl={values.baseUrl ?? ''}
                onField={setField}
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
