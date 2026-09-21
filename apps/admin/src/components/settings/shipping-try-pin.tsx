'use client'

import { Banner, BlockStack, Button, Card, InlineStack, Text, TextField } from '@shopify/polaris'
import { useState } from 'react'
import { shippingSettingsContent as copy } from '@/data/shipping'
import { api } from '@/lib/api-client'

type Estimate = Awaited<ReturnType<typeof api.store.estimateDelivery>>
type Verify = Awaited<ReturnType<typeof api.store.verifyShipping>>

function describe(r: Estimate): { tone: 'success' | 'warning' | 'critical'; lines: string[] } {
  if (!r.ok) return { tone: 'critical', lines: [r.error] }
  if (!r.serviceable) return { tone: 'warning', lines: [copy.tryPin.unserviceable(r.reason)] }
  const lines = [
    copy.tryPin.serviceable(r.dateRange, r.dispatchLabel),
    copy.tryPin.cod(r.codAvailable),
  ]
  if (r.fallback) lines.push(copy.tryPin.fallback)
  return { tone: r.fallback ? 'warning' : 'success', lines }
}

/** "Try a PIN" and "Test connection" for Settings › Shipping. Both hit the saved settings. */
export function ShippingTryPin() {
  const [pincode, setPincode] = useState('')
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [verify, setVerify] = useState<Verify | null>(null)
  const [checking, setChecking] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const handleCheck = async () => {
    setChecking(true)
    try {
      setEstimate(await api.store.estimateDelivery({ pincode }))
    } catch (err) {
      setEstimate({ ok: false, error: err instanceof Error ? err.message : 'Lookup failed' })
    } finally {
      setChecking(false)
    }
  }
  const handleVerify = async () => {
    setVerifying(true)
    try {
      setVerify(await api.store.verifyShipping())
    } catch (err) {
      setVerify({ ok: false, message: err instanceof Error ? err.message : 'Could not verify' })
    } finally {
      setVerifying(false)
    }
  }

  const shown = estimate ? describe(estimate) : null

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          {copy.tryPin.heading}
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          {copy.tryPin.help}
        </Text>
        <InlineStack gap="200" blockAlign="end">
          <TextField
            label={copy.tryPin.label}
            value={pincode}
            onChange={setPincode}
            autoComplete="off"
            inputMode="numeric"
          />
          <Button onClick={handleCheck} loading={checking} disabled={pincode.length < 6}>
            {checking ? copy.tryPin.checking : copy.tryPin.button}
          </Button>
          <Button onClick={handleVerify} loading={verifying} variant="secondary">
            {verifying ? copy.verifying : copy.verify}
          </Button>
        </InlineStack>
        {shown ? (
          <Banner tone={shown.tone}>
            {shown.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </Banner>
        ) : null}
        {verify ? (
          <Banner tone={verify.ok ? 'success' : 'critical'}>
            <p>{verify.message}</p>
          </Banner>
        ) : null}
      </BlockStack>
    </Card>
  )
}
