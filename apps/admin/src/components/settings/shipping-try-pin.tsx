'use client'

import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { shippingSettingsContent as copy } from '@/data/shipping'
import { api } from '@/lib/api-client'

type Estimate = Awaited<ReturnType<typeof api.store.estimateDelivery>>
type Verify = Awaited<ReturnType<typeof api.store.verifyShipping>>
type Tone = 'success' | 'warning' | 'critical'

function describe(r: Estimate): { tone: Tone; lines: string[] } {
  if (!r.ok) return { tone: 'critical', lines: [r.error] }
  if (!r.serviceable) return { tone: 'warning', lines: [copy.tryPin.unserviceable(r.reason)] }
  const lines = [
    copy.tryPin.serviceable(r.dateRange, r.dispatchLabel),
    copy.tryPin.cod(r.codAvailable),
  ]

  if (r.fallback) lines.push(copy.tryPin.fallback)
  return { tone: r.fallback ? 'warning' : 'success', lines }
}

const TONE_ICON = { success: CircleCheck, warning: TriangleAlert, critical: CircleAlert }
const TONE_CLASS: Record<Tone, string> = {
  success: 'text-success [&_svg]:text-success',
  warning: 'text-warning-foreground [&_svg]:text-warning dark:text-warning',
  critical: 'text-destructive [&_svg]:text-destructive',
}

function ResultAlert({ tone, lines }: { tone: Tone; lines: string[] }) {
  const Icon = TONE_ICON[tone]
  return (
    <Alert className={TONE_CLASS[tone]}>
      <Icon />
      <AlertDescription className="text-foreground">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </AlertDescription>
    </Alert>
  )
}

/** "Try a PIN" and "Test connection" for Settings › Shipping. Both hit the saved settings. */
export default function ShippingTryPin() {
  // Hooks
  const [pincode, setPincode] = useState('')
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [verify, setVerify] = useState<Verify | null>(null)
  const [checking, setChecking] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // Event handlers
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

  // Render logic
  const shown = estimate ? describe(estimate) : null

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.tryPin.heading}</CardTitle>
        <CardDescription>{copy.tryPin.help}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field className="w-44">
            <FieldLabel htmlFor="try-pin">{copy.tryPin.label}</FieldLabel>
            <Input
              size="lg"
              id="try-pin"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
              autoComplete="off"
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            onClick={handleCheck}
            disabled={checking || pincode.length < 6}
          >
            {checking ? <Spinner /> : null}
            {checking ? copy.tryPin.checking : copy.tryPin.button}
          </Button>
          <Button type="button" variant="outline" onClick={handleVerify} disabled={verifying}>
            {verifying ? <Spinner /> : null}
            {verifying ? copy.verifying : copy.verify}
          </Button>
        </div>
        {shown ? <ResultAlert tone={shown.tone} lines={shown.lines} /> : null}
        {verify ? (
          <ResultAlert tone={verify.ok ? 'success' : 'critical'} lines={[verify.message]} />
        ) : null}
      </CardContent>
    </Card>
  )
}
