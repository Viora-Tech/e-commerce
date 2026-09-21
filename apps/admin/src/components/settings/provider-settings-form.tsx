'use client'

import {
  Badge,
  Banner,
  BlockStack,
  Card,
  Checkbox,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
  Toast,
} from '@shopify/polaris'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { providerSettingsContent as copy } from '@/data/provider-settings'

/** One field of a provider's config, as its factory declares it. */
export type ProviderFieldDef = {
  key: string
  label: string
  secret?: boolean | undefined
  required?: boolean | undefined
  multiline?: boolean | undefined
  type?: 'text' | 'boolean' | undefined
  help?: string | undefined
}

export type ProviderDef = { id: string; label: string; fields: ProviderFieldDef[] }

export type ProviderValues = Record<string, Record<string, string>>

/** The enabled list plus per-provider config; the generic part of every settings blob. */
export type ProviderState = { enabled: string[]; providers: ProviderValues }

type ProviderSettingsFormProps<Extra> = {
  title: string
  /** Fetch `{ settings, available }`; `extra` is whatever else the blob carries (e.g. adjustments). */
  load: () => Promise<{ settings: ProviderState & Extra; available: ProviderDef[] }>
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

/**
 * Generic "enable providers and fill their credentials" page used by
 * Payments and Notifications. The provider list and its fields come from the
 * server registry, so an adapter package adds itself without admin changes.
 */
export function ProviderSettingsForm<Extra extends object>({
  title,
  load,
  save,
  emptyExtra,
  renderHint,
  renderExtra,
  renderFooter,
  noConfigText,
}: ProviderSettingsFormProps<Extra>) {
  const [available, setAvailable] = useState<ProviderDef[] | null>(null)
  const [enabled, setEnabled] = useState<string[]>([])
  const [providers, setProviders] = useState<ProviderValues>({})
  const [extra, setExtra] = useState<Extra>(emptyExtra)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load().then((d) => {
      const { enabled: e, providers: p, ...rest } = d.settings
      setAvailable(d.available)
      setEnabled(e)
      setProviders(p)
      setExtra(rest as Extra)
    })
  }, [load])

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved = await save({ enabled, providers, ...extra })
      if (saved) {
        const { enabled: e, providers: p, ...rest } = saved
        setEnabled(e)
        setProviders(p)
        setExtra(rest as Extra)
      }
      setToast(copy.saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string, on: boolean) =>
    setEnabled((e) => (on ? [...new Set([...e, id])] : e.filter((x) => x !== id)))
  const setField = (id: string, key: string, value: string) =>
    setProviders((p) => ({ ...p, [id]: { ...(p[id] ?? {}), [key]: value } }))

  return (
    <Page
      title={title}
      backAction={{ content: copy.back, url: '/settings' }}
      primaryAction={{
        content: copy.save,
        onAction: handleSave,
        loading: busy,
        disabled: !available,
      }}
    >
      {toast ? <Toast content={toast} onDismiss={() => setToast(null)} /> : null}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {error ? (
              <Banner tone="critical" title={copy.couldNotSave}>
                <p>{error}</p>
              </Banner>
            ) : null}
            {(available ?? []).map((m) => {
              const on = enabled.includes(m.id)
              return (
                <Card key={m.id}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingSm">
                          {m.label}
                        </Text>
                        {on ? (
                          <Badge tone="success">{copy.active}</Badge>
                        ) : (
                          <Badge>{copy.off}</Badge>
                        )}
                      </InlineStack>
                      <Checkbox
                        label={copy.enabled}
                        checked={on}
                        onChange={(v) => toggle(m.id, v)}
                      />
                    </InlineStack>
                    {m.fields.length > 0 ? (
                      <FormLayout>
                        {m.fields.map((f) =>
                          f.type === 'boolean' ? (
                            <Checkbox
                              key={f.key}
                              label={f.label}
                              helpText={f.help}
                              checked={providers[m.id]?.[f.key] === 'true'}
                              onChange={(v) => setField(m.id, f.key, v ? 'true' : 'false')}
                            />
                          ) : (
                            <TextField
                              key={f.key}
                              label={f.label}
                              type={f.secret ? 'password' : 'text'}
                              multiline={f.multiline ? 3 : undefined}
                              requiredIndicator={f.required}
                              value={providers[m.id]?.[f.key] ?? ''}
                              onChange={(v) => setField(m.id, f.key, v)}
                              autoComplete="off"
                              helpText={f.secret ? copy.secretHelp : f.help}
                            />
                          ),
                        )}
                        {renderHint?.(m)}
                      </FormLayout>
                    ) : (
                      <Text as="p" tone="subdued">
                        {noConfigText ?? copy.noConfig}
                      </Text>
                    )}
                    {on && renderExtra ? renderExtra(m, extra, setExtra) : null}
                  </BlockStack>
                </Card>
              )
            })}
            {available && renderFooter ? renderFooter(extra, setExtra) : null}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
