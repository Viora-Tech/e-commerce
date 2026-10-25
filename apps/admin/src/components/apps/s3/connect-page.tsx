'use client'

import { CircleAlert, CircleCheck, ExternalLink, RefreshCw, Upload } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import type { ProviderDef, ProviderState } from '@/components/settings/provider-settings-form'
import { s3AppContent as appCopy, s3CorsRule, s3IamPolicy } from '@/data/s3'
import { api } from '@/lib/api-client'
import CodeBlock from './code-block'
import MoveFilesCard from './move-files-card'

type Blob = ProviderState & Record<string, unknown>
type FieldValues = Record<string, string>
type TestResult = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string }

const copy = appCopy.connect
const PROVIDER_ID = 's3'

const emptyValues: FieldValues = {
  accessKeyId: '',
  secretAccessKey: '',
  region: '',
  bucket: '',
  publicBaseUrl: '',
  pathPrefix: '',
}

/** The admin's own origin, so the CORS snippet is correct without asking the merchant to know it. */
const adminOrigin = () => (typeof window === 'undefined' ? '' : window.location.origin)

/** The Amazon S3 app's own credentials screen: bucket + IAM steps, the exact policy and CORS
 *  JSON to paste into AWS, a read-only "Test connection" check, and "Move existing files". */
export default function ConnectPage() {
  // Hooks
  const [provider, setProvider] = useState<ProviderDef | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [values, setValues] = useState<FieldValues>(emptyValues)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState<TestResult>({ status: 'idle' })

  useEffect(() => {
    api.store.getStorage().then((r) => {
      const def = r.available.find((p) => p.id === PROVIDER_ID) ?? null
      const saved = { ...emptyValues, ...(r.settings.providers[PROVIDER_ID] ?? {}) }
      setProvider(def)
      setBlob(r.settings as Blob)
      setValues(saved)
      setSnapshot(JSON.stringify(saved))
    })
  }, [])

  // Event handlers
  const setField = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setTest({ status: 'idle' })
  }

  const handleTest = async () => {
    setTest({ status: 'testing' })
    try {
      const result = await api.store.testStorageConnection({
        providerId: PROVIDER_ID,
        fields: values,
      })
      setTest(
        result.ok
          ? { status: 'ok', message: result.message }
          : { status: 'error', message: result.message },
      )
    } catch (err) {
      setTest({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not test the connection.',
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
      const result = (await api.store.updateStorage(next)) as Blob | null
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
  const connected = blob?.enabled.includes(PROVIDER_ID) ?? false

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message="Unsaved changes"
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        lead={{ kind: 'icon', node: <Upload aria-hidden="true" /> }}
      />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {provider === null ? (
        <Card gap={4} inset={6}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : (
        <>
          <DataCard
            title={copy.steps.one.title}
            subtitle={copy.steps.one.body}
            bodyClassName="flex justify-end"
          >
            <Button
              variant="outline"
              className="w-fit gap-1.5"
              render={<a href={copy.consoleUrl} target="_blank" rel="noreferrer" />}
            >
              {copy.openConsole}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Button>
          </DataCard>

          <DataCard
            title={copy.steps.two.title}
            subtitle={copy.steps.two.body}
            bodyClassName="flex flex-col gap-3"
          >
            <Button
              variant="outline"
              className="w-fit gap-1.5"
              render={<a href={copy.iamUrl} target="_blank" rel="noreferrer" />}
            >
              {copy.openIam}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Button>
            <CodeBlock what="IAM policy" code={s3IamPolicy(values.bucket ?? '')} />
          </DataCard>

          <DataCard title={copy.publicAccess.heading}>
            <p className="text-body text-muted-foreground">{copy.publicAccess.body}</p>
          </DataCard>

          <DataCard title={copy.cors.heading} subtitle={copy.cors.body}>
            <CodeBlock what="CORS rule" code={s3CorsRule(adminOrigin())} />
          </DataCard>

          <DataCard
            title={copy.steps.three.title}
            subtitle={copy.steps.three.body}
            bodyClassName="flex flex-col gap-5"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="s3-accessKeyId">{copy.fields.accessKeyId.label}</FieldLabel>
                <Input
                  size="lg"
                  id="s3-accessKeyId"
                  autoComplete="off"
                  value={values.accessKeyId}
                  onChange={(e) => setField('accessKeyId', e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="s3-secretAccessKey">
                  {copy.fields.secretAccessKey.label}
                </FieldLabel>
                <Input
                  size="lg"
                  id="s3-secretAccessKey"
                  type="password"
                  autoComplete="off"
                  value={values.secretAccessKey}
                  onChange={(e) => setField('secretAccessKey', e.target.value)}
                />
                <FieldDescription>{copy.fields.secretAccessKey.help}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="s3-region">{copy.fields.region.label}</FieldLabel>
                <Input
                  size="lg"
                  id="s3-region"
                  autoComplete="off"
                  value={values.region}
                  onChange={(e) => setField('region', e.target.value)}
                />
                <FieldDescription>{copy.fields.region.help}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="s3-bucket">{copy.fields.bucket.label}</FieldLabel>
                <Input
                  size="lg"
                  id="s3-bucket"
                  autoComplete="off"
                  value={values.bucket}
                  onChange={(e) => setField('bucket', e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="s3-publicBaseUrl">
                  {copy.fields.publicBaseUrl.label}
                </FieldLabel>
                <Input
                  size="lg"
                  id="s3-publicBaseUrl"
                  autoComplete="off"
                  value={values.publicBaseUrl}
                  onChange={(e) => setField('publicBaseUrl', e.target.value)}
                />
                <FieldDescription>{copy.fields.publicBaseUrl.help}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="s3-pathPrefix">{copy.fields.pathPrefix.label}</FieldLabel>
                <Input
                  size="lg"
                  id="s3-pathPrefix"
                  autoComplete="off"
                  value={values.pathPrefix}
                  onChange={(e) => setField('pathPrefix', e.target.value)}
                />
                <FieldDescription>{copy.fields.pathPrefix.help}</FieldDescription>
              </Field>
            </FieldGroup>

            <div className="flex flex-col gap-2">
              <p className="text-body font-medium text-foreground">{copy.steps.four.title}</p>
              <p className="text-caption text-muted-foreground">{copy.steps.four.body}</p>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={handleTest}
                disabled={test.status === 'testing'}
              >
                {test.status === 'testing' ? <Spinner /> : <RefreshCw aria-hidden="true" />}
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
          </DataCard>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.nextImage.heading}</CardTitle>
              <CardDescription>{copy.nextImage.body}</CardDescription>
            </CardHeader>
          </Card>

          {connected ? (
            <MoveFilesCard targetProviderId={PROVIDER_ID} targetLabel={provider.label} />
          ) : null}
        </>
      )}
    </div>
  )
}
