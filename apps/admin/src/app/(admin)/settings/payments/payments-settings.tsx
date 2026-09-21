'use client'

import type { PaymentAdjustment } from '@commerce/core'
import {
  Badge,
  Banner,
  BlockStack,
  Card,
  Checkbox,
  Divider,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
  Toast,
} from '@shopify/polaris'
import { useEffect, useState } from 'react'
import { PaymentAdjustmentFields } from '@/components/settings/payment-adjustment-fields'
import { paymentsSettingsContent as copy } from '@/data/payments'
import { api } from '@/lib/api-client'

type Data = Awaited<ReturnType<typeof api.store.getPayments>>
type Providers = Record<string, Record<string, string>>
type Adjustments = Record<string, PaymentAdjustment>

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

export function PaymentsSettings() {
  const [data, setData] = useState<Data | null>(null)
  const [enabled, setEnabled] = useState<string[]>([])
  const [providers, setProviders] = useState<Providers>({})
  const [adjustments, setAdjustments] = useState<Adjustments>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.store.getPayments().then((d) => {
      setData(d)
      setEnabled(d.settings.enabled)
      setProviders(d.settings.providers)
      setAdjustments(d.settings.adjustments)
    })
  }, [])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const saved = await api.store.updatePayments({ enabled, providers, adjustments })
      if (saved) {
        setEnabled(saved.enabled)
        setProviders(saved.providers)
        setAdjustments(saved.adjustments)
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
  const setAdjustment = (id: string, adj: PaymentAdjustment | undefined) =>
    setAdjustments((a) => {
      const { [id]: _drop, ...rest } = a
      return adj ? { ...rest, [id]: adj } : rest
    })

  return (
    <Page
      title={copy.title}
      backAction={{ content: copy.back, url: '/settings' }}
      primaryAction={{ content: copy.save, onAction: save, loading: busy, disabled: !data }}
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
            {(data?.available ?? []).map((m) => {
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
                        {m.id === 'razorpay' ? (
                          <Text as="p" tone="subdued" variant="bodySm">
                            {copy.webhookHint}{' '}
                            <code>{`${WORKER_URL}/webhooks/payments/razorpay/<store id>`}</code>
                          </Text>
                        ) : null}
                      </FormLayout>
                    ) : (
                      <Text as="p" tone="subdued">
                        {copy.noConfig}
                      </Text>
                    )}
                    {on ? (
                      <>
                        <Divider />
                        <PaymentAdjustmentFields
                          value={adjustments[m.id]}
                          onChange={(adj) => setAdjustment(m.id, adj)}
                        />
                      </>
                    ) : null}
                  </BlockStack>
                </Card>
              )
            })}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
