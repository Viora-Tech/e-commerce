'use client'

import { CircleAlert, Puzzle } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { providerSettingsContent as copy } from '@/data/provider-settings'
import ProviderCard, { type ProviderDef } from './provider-card'
import SectionTabs, { type SectionTab } from './section-tabs'
import SettingsSection from './settings-section'

export type { ProviderDef, ProviderFieldDef } from './provider-card'

export type ProviderValues = Record<string, Record<string, string>>

/** The enabled list plus per-provider config; the generic part of every settings blob. */
export type ProviderState = { enabled: string[]; providers: ProviderValues }

type Loaded<Extra> = { settings: ProviderState & Extra; available: ProviderDef[] }

type ProviderSettingsFormProps<Extra> = {
  title: string
  intro?: string | undefined
  /** The settings section's glyph, shown in the header's icon badge. */
  icon?: ReactNode
  /** Fetch `{ settings, available }`; `extra` is whatever else the blob carries (e.g. adjustments). */
  load: () => Promise<Loaded<Extra>>
  /** Persist; returns the saved blob or null. */
  save: (next: ProviderState & Extra) => Promise<(ProviderState & Extra) | null>
  /** Starting value for the extra part while loading. */
  emptyExtra: Extra
  /** Rendered under a provider's fields, e.g. a webhook URL hint. */
  renderHint?: ((provider: ProviderDef) => ReactNode) | undefined
  /** A plain line on what a provider is, at the top of its card. */
  renderDescription?: ((provider: ProviderDef) => ReactNode) | undefined
  /** The parent page, shown as the back button beside the title. */
  back?: { label: string; href: string } | undefined
  /** Rendered under an enabled provider, receives and updates the extra part. */
  renderExtra?:
    | ((provider: ProviderDef, extra: Extra, setExtra: (next: Extra) => void) => ReactNode)
    | undefined
  /** Rendered once below every provider card; for store-wide settings that live in the same blob. */
  renderFooter?: ((extra: Extra, setExtra: (next: Extra) => void) => ReactNode) | undefined
  /** Copy shown when a provider has no fields. */
  noConfigText?: string | undefined
  /** In-page anchors shown on the left; the provider list itself takes the first id. */
  sections?: readonly SectionTab[] | undefined
  /** Anchor id placed on the first enabled provider's extra block (e.g. fees). */
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
        <Card key={i} gap={4} inset={6}>
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
export default function ProviderSettingsForm<Extra extends object>({
  title,
  intro,
  icon,
  load,
  save,
  emptyExtra,
  renderHint,
  renderDescription,
  back,
  renderExtra,
  renderFooter,
  noConfigText,
  sections,
}: ProviderSettingsFormProps<Extra>) {
  // Hooks
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

  // Helpers
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

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await save({ enabled: form.enabled, providers: form.providers, ...form.extra })
      const next = result ? split(result) : form
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (saved) setForm(JSON.parse(saved) as FormState<Extra>)
    setError(null)
  }

  // Render logic
  const dirty = saved !== null && JSON.stringify(form) !== saved

  const providersSectionId = sections?.[0]?.id

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={title}
        subtitle={intro}
        icon={back ? undefined : icon}
        breadcrumbs={back ? [back, { label: title }] : undefined}
      />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.couldNotSave}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <SectionTabs tabs={sections ?? []}>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <SettingsSection
            id={providersSectionId ?? 'section-providers'}
            className="flex flex-col gap-4"
          >
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
                const extra = on && renderExtra ? renderExtra(m, form.extra, setExtra) : null
                return (
                  <ProviderCard
                    key={m.id}
                    provider={m}
                    enabled={on}
                    values={form.providers[m.id] ?? {}}
                    onToggle={(v) => toggle(m.id, v)}
                    onField={(k, v) => setField(m.id, k, v)}
                    hint={renderHint?.(m)}
                    description={renderDescription?.(m)}
                    extra={extra}
                    noConfigText={noConfigText}
                  />
                )
              })
            )}
          </SettingsSection>
          {available && renderFooter ? renderFooter(form.extra, setExtra) : null}
        </div>
      </SectionTabs>
    </div>
  )
}
