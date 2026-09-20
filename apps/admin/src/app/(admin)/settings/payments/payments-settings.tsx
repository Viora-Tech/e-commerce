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
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

type Data = Awaited<ReturnType<typeof api.store.getPayments>>

export function PaymentsSettings() {
  const [data, setData] = useState<Data | null>(null)
  const [enabled, setEnabled] = useState<string[]>([])
  const [providers, setProviders] = useState<Record<string, Record<string, string>>>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.store.getPayments().then((d) => {
      setData(d)
      setEnabled(d.settings.enabled)
      setProviders(d.settings.providers)
    })
  }, [])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const saved = await api.store.updatePayments({ enabled, providers })
      if (saved) {
        setEnabled(saved.enabled)
        setProviders(saved.providers)
      }
      setToast('Payment settings saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
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
      title="Payments"
      backAction={{ content: 'Settings', url: '/settings' }}
      primaryAction={{ content: 'Save', onAction: save, loading: busy, disabled: !data }}
    >
      {toast ? <Toast content={toast} onDismiss={() => setToast(null)} /> : null}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {error ? (
              <Banner tone="critical" title="Could not save">
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
                        {on ? <Badge tone="success">Active</Badge> : <Badge>Off</Badge>}
                      </InlineStack>
                      <Checkbox label="Enabled" checked={on} onChange={(v) => toggle(m.id, v)} />
                    </InlineStack>
                    {m.fields.length > 0 ? (
                      <FormLayout>
                        {m.fields.map((f) => (
                          <TextField
                            key={f.key}
                            label={f.label}
                            type={f.secret ? 'password' : 'text'}
                            value={providers[m.id]?.[f.key] ?? ''}
                            onChange={(v) => setField(m.id, f.key, v)}
                            autoComplete="off"
                            helpText={
                              f.secret
                                ? 'Stored encrypted. Leave the masked value to keep it.'
                                : undefined
                            }
                          />
                        ))}
                        {m.id === 'razorpay' ? (
                          <Text as="p" tone="subdued" variant="bodySm">
                            Webhook URL for the Razorpay dashboard:{' '}
                            <code>{`${process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'}/webhooks/payments/razorpay/<store id>`}</code>
                          </Text>
                        ) : null}
                      </FormLayout>
                    ) : (
                      <Text as="p" tone="subdued">
                        No configuration needed.
                      </Text>
                    )}
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
