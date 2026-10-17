'use client'

import { CircleAlert, CircleCheck, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { DialogDescription, DialogFooter, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { appInstallContent } from '@/data/app-install'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

export type ConnectForm = NonNullable<Awaited<ReturnType<typeof api.apps.connectForm>>>

export type TestState = {
  status: 'idle' | 'testing' | 'ok' | 'error'
  message?: string | undefined
}

type InstallConnectStepProps = {
  appName: string
  form: ConnectForm
  values: Record<string, string>
  test: TestState
  onField: (key: string, value: string) => void
  onTest: () => void
  onCancel: () => void
  onContinue: () => void
}

/** Step 1, "Connect account" (Figma "Connect step 1 — account"): the account's required fields and a read-only test. */
export default function InstallConnectStep({
  appName,
  form,
  values,
  test,
  onField,
  onTest,
  onCancel,
  onContinue,
}: InstallConnectStepProps) {
  // Hooks
  const copy = useCopy(appInstallContent)

  // Render logic
  const filled = form.fields.every((f) => (values[f.key] ?? '').trim() !== '')
  const testing = test.status === 'testing'

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <DialogTitle>{copy.connect.title(appName)}</DialogTitle>
        <DialogDescription>{copy.connect.intro(appName)}</DialogDescription>
      </div>
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {form.fields.map((f, i) => (
          <Field key={f.key} className={i === 0 || f.secret ? 'sm:col-span-2' : undefined}>
            <FieldLabel htmlFor={`install-${f.key}`}>{f.label}</FieldLabel>
            <Input
              id={`install-${f.key}`}
              type={f.secret ? 'password' : 'text'}
              autoComplete="off"
              value={values[f.key] ?? ''}
              onChange={(e) => onField(f.key, e.target.value)}
            />
            {f.help ? <FieldDescription>{f.help}</FieldDescription> : null}
          </Field>
        ))}
      </FieldGroup>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={onTest} disabled={testing || !filled}>
            {testing ? <Spinner /> : <RefreshCw aria-hidden="true" />}
            {testing ? copy.connect.testing : copy.connect.test}
          </Button>
          <span className="text-caption text-muted-foreground">
            {copy.connect.testHint(appName)}
          </span>
        </div>
        {test.status === 'ok' ? (
          <p className="flex items-center gap-1.5 text-body font-medium text-success">
            <CircleCheck aria-hidden="true" className="size-4" />
            {test.message}
          </p>
        ) : test.status === 'error' ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 text-body font-medium text-destructive"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {test.message || copy.connect.testFailed}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {copy.connect.cancel}
        </Button>
        <Button onClick={onContinue} disabled={!filled || testing} loading={testing}>
          {copy.connect.continue}
        </Button>
      </DialogFooter>
    </>
  )
}
