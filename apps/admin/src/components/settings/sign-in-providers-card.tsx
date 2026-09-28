'use client'

import type { CustomerAccountSettings as Settings } from '@commerce/core'
import {
  LOGIN_PROVIDERS,
  type LoginProvider,
  type ProviderReadiness,
} from '@commerce/core/customer-accounts'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'
import { customerAccountsContent, PROVIDER_COPY } from '@/data/customer-accounts'
import { useCopy } from '@/hooks/use-copy'

type SignInProvidersCardProps = {
  form: Settings
  onChange: (next: Settings) => void
  readiness: ProviderReadiness
  /** Open the guided setup for the merchant's own app. */
  onSetUp: (provider: LoginProvider) => void
}

/** Google, Apple, Facebook and Truecaller: one switch each, and whose app signs customers in. */
export default function SignInProvidersCard({
  form,
  onChange,
  readiness,
  onSetUp,
}: SignInProvidersCardProps) {
  // Hooks
  const content = useCopy(customerAccountsContent)
  const providers = useCopy(PROVIDER_COPY)

  // Helpers
  const setProvider = (p: LoginProvider, patch: Partial<Settings['providers'][LoginProvider]>) => {
    onChange({ ...form, providers: { ...form.providers, [p]: { ...form.providers[p], ...patch } } })
  }

  // Event handlers
  const handleToggle = (p: LoginProvider, on: boolean) => {
    // Without the platform's app the only way is the merchant's own.
    const credentials = readiness[p].platform ? form.providers[p].credentials : 'own'
    setProvider(p, { enabled: on, credentials })
    if (on && credentials === 'own' && !readiness[p].own) onSetUp(p)
  }

  const handleOwn = (p: LoginProvider, own: boolean) => {
    setProvider(p, { credentials: own ? 'own' : 'platform' })
    if (own && !readiness[p].own) onSetUp(p)
  }

  return (
    <Card size="form" id="providers">
      <CardHeader>
        <CardTitle>{content.providers.heading}</CardTitle>
        <CardDescription>{content.providers.body}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {LOGIN_PROVIDERS.map((p) => {
            const s = form.providers[p]
            const text = providers[p]
            const own = s.credentials === 'own' || !readiness[p].platform
            const ready = own ? readiness[p].own : readiness[p].platform
            const status = !s.enabled
              ? readiness[p].platform
                ? content.providers.usesPlatform
                : content.providers.notOnPlatform
              : !ready
                ? content.providers.needsSetup
                : own
                  ? content.providers.usesOwn
                  : content.providers.usesPlatform
            return (
              <div key={p} className="flex flex-col gap-3">
                <Field orientation="horizontal" className="items-start justify-between">
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor={`provider-${p}`} className="flex items-center gap-2">
                      {text.label}
                      {s.enabled && !ready ? (
                        <Badge variant="neutral">{content.providers.setUp}</Badge>
                      ) : null}
                    </FieldLabel>
                    <FieldDescription>{text.hint}</FieldDescription>
                    <FieldDescription>{status}</FieldDescription>
                  </div>
                  <Switch
                    id={`provider-${p}`}
                    checked={s.enabled}
                    onCheckedChange={(on) => handleToggle(p, on)}
                  />
                </Field>
                {s.enabled ? (
                  <div className="flex flex-col gap-3 rounded-lg border p-3">
                    {readiness[p].platform ? (
                      <Field orientation="horizontal" className="items-start gap-3">
                        <Checkbox
                          id={`provider-own-${p}`}
                          checked={s.credentials === 'own'}
                          onCheckedChange={(on) => handleOwn(p, on === true)}
                        />
                        <div className="flex flex-col gap-0.5">
                          <FieldLabel htmlFor={`provider-own-${p}`}>
                            {content.providers.useOwn}
                          </FieldLabel>
                          <FieldDescription>{content.providers.useOwnHint}</FieldDescription>
                        </div>
                      </Field>
                    ) : null}
                    {own ? (
                      <Button variant="outline" className="w-fit" onClick={() => onSetUp(p)}>
                        {readiness[p].own ? content.providers.change : content.providers.setUp}
                      </Button>
                    ) : null}
                    {p === 'google' ? (
                      <Field orientation="horizontal" className="items-start justify-between">
                        <div className="flex flex-col gap-0.5">
                          <FieldLabel htmlFor="provider-one-tap">
                            {content.providers.oneTap.label}
                          </FieldLabel>
                          <FieldDescription>
                            {own
                              ? content.providers.oneTap.hint
                              : content.providers.oneTap.needsOwn}
                          </FieldDescription>
                        </div>
                        <Switch
                          id="provider-one-tap"
                          checked={form.googleOneTap && own}
                          disabled={!own}
                          onCheckedChange={(on) => onChange({ ...form, googleOneTap: on })}
                        />
                      </Field>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
