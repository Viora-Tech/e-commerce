'use client'

import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { CircleAlert, Puzzle } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/layout/empty-state'
import { PageBody } from '@/components/layout/page-body'
import { PageHeader } from '@/components/layout/page-header'
import { SaveBar } from '@/components/layout/save-bar'
import { providerSettingsContent as copy } from '@/data/provider-settings'
import { ProviderCard, type ProviderDef } from './provider-card'

export type { ProviderDef, ProviderFieldDef } from './provider-card'

export type ProviderValues = Record<string, Record<string, string>>

/** The enabled list plus per-provider config; the generic part of every settings blob. */
export type ProviderState = { enabled: string[]; providers: ProviderValues }

type Loaded<Extra> = { settings: ProviderState & Extra; available: ProviderDef[] }

type ProviderSettingsFormProps<Extra> = {
  title: string
  intro?: string | undefined
  /** Fetch `{ settings, available }`; `extra` is whatever else the blob carries (e.g. adjustments). */
  load: () => Promise<Loaded<Extra>>
  /** Persist; returns the saved blob or null. */
  save: (next: ProviderState & Extra) => Promise<(ProviderState & Extra) | null>
  /** Starting value for the extra part while loading. */
  emptyExtra: Extra
  /** Rendered under a provider's fields, e.g. a webhook URL hint. */
  renderHint?: ((provider: ProviderDef) => ReactNode) | undefined
  /** Rendered under an enabled provider, receives and updates the extra part. */
  renderExtra?:
    | ((provider: ProviderDef, extra: Extra, setExtra: (next: Extra) => void) => ReactNode)
    | undefined
  /** Rendered once below every provider card; for store-wide settings that live in the same blob. */
  renderFooter?: ((extra: Extra, setExtra: (next: Extra) => void) => ReactNode) | undefined
  /** Copy shown when a provider has no fields. */
  noConfigText?: string | undefined
}

type FormState<Extra> = { enabled: string[]; providers: ProviderValues; extra: Extra }

function split<Extra>(blob: ProviderState & Extra): FormState<Extra> {
  const { enabled, providers, ...rest } = blob
  return { enabled, providers, extra: rest as Extra }
}

function LoadingCards() {
  return (
    <>
      {[0, 1].map((i) => (
        <Card key={i} className="gap-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ))}
    </>
  )
}

/**
 * Generic "enable providers and fill their credentials" page used by
 * Payments, Shipping and Notifications. The provider list and its fields come
 * from the server registry, so an adapter package adds itself without admin
 * changes. Unsaved edits raise the contextual save bar like every other form.
 */
export function ProviderSettingsForm<Extra extends object>({
  title,
  intro,
  load,
  save,
  emptyExtra,
  renderHint,
  renderExtra,
  renderFooter,
  noConfigText,
}: ProviderSettingsFormProps<Extra>) {
  const [available, setAvailable] = useState<ProviderDef[] | null>(null)
  const [form, setForm] = useState<FormState<Extra>>({
    enabled: [],
    providers: {},
    extra: emptyExtra,
  })
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load().then((d) => {
      const next = split(d.settings)
      setAvailable(d.available)
      setForm(next)
      setSaved(JSON.stringify(next))
    })
  }, [load])

  const dirty = saved !== null && JSON.stringify(form) !== saved
  const setExtra = (extra: Extra) => setForm((f) => ({ ...f, extra }))
  const toggle = (id: string, on: boolean) =>
    setForm((f) => ({
      ...f,
      enabled: on ? [...new Set([...f.enabled, id])] : f.enabled.filter((x) => x !== id),
    }))
  const setField = (id: string, key: string, value: string) =>
    setForm((f) => ({
      ...f,
      providers: { ...f.providers, [id]: { ...(f.providers[id] ?? {}), [key]: value } },
    }))

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      const result = await save({ enabled: form.enabled, providers: form.providers, ...form.extra })
      const next = result ? split(result) : form
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  function discard() {
    if (saved) setForm(JSON.parse(saved) as FormState<Extra>)
    setError(null)
  }

  return (
    <PageBody width="narrow">
      {dirty ? (
        <SaveBar
          message={copy.unsaved}
          saveLabel={copy.save}
          discardLabel={copy.discard}
          onSave={handleSave}
          onDiscard={discard}
          saving={busy}
        />
      ) : null}
      <PageHeader
        title={title}
        subtitle={intro}
        breadcrumbs={[{ label: copy.back, href: '/settings' }, { label: title }]}
      />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.couldNotSave}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {available === null ? (
        <LoadingCards />
      ) : available.length === 0 ? (
        <Card>
          <EmptyState
            icon={Puzzle}
            heading={copy.noProviders.heading}
            body={copy.noProviders.body}
            action={
              <Button variant="outline" render={<Link href={copy.noProviders.href} />}>
                {copy.noProviders.action}
              </Button>
            }
          />
        </Card>
      ) : (
        available.map((m) => {
          const on = form.enabled.includes(m.id)
          return (
            <ProviderCard
              key={m.id}
              provider={m}
              enabled={on}
              values={form.providers[m.id] ?? {}}
              onToggle={(v) => toggle(m.id, v)}
              onField={(k, v) => setField(m.id, k, v)}
              hint={renderHint?.(m)}
              extra={on && renderExtra ? renderExtra(m, form.extra, setExtra) : null}
              noConfigText={noConfigText}
            />
          )
        })
      )}
      {available && renderFooter ? renderFooter(form.extra, setExtra) : null}
    </PageBody>
  )
}
