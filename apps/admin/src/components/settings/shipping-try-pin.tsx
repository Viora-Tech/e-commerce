'use client'

import { CircleAlert, CircleCheck, TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { shippingSettingsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Estimate = Awaited<ReturnType<typeof api.store.estimateDelivery>>
type Tone = 'success' | 'warning' | 'critical'
type TryPinCopy = (typeof shippingSettingsContent)['tryPin']

/** An empty `error` means our own "could not check" message, looked up at render. */
function describe(copy: TryPinCopy, r: Estimate): { tone: Tone; lines: string[] } {
  if (!r.ok) return { tone: 'critical', lines: [r.error || copy.failed] }
  if (!r.serviceable) return { tone: 'warning', lines: [copy.unserviceable(r.reason)] }
  const lines = [copy.serviceable(r.dateRange, r.dispatchLabel), copy.cod(r.codAvailable)]

  if (r.fallback) lines.push(copy.fallback)
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

/** "Check delivery to a pincode" on Settings › Shipping: what a customer there would see. Uses the saved settings. */
export default function ShippingTryPin() {
  // Hooks
  const copy = useCopy(shippingSettingsContent)
  const [pincode, setPincode] = useState('')
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [checking, setChecking] = useState(false)

  // Event handlers
  const handleCheck = async () => {
    setChecking(true)
    try {
      setEstimate(await api.store.estimateDelivery({ pincode }))
    } catch (err) {
      setEstimate({ ok: false, error: err instanceof Error ? err.message : '' })
    } finally {
      setChecking(false)
    }
  }

  // Render logic
  const shown = estimate ? describe(copy.tryPin, estimate) : null

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
        </div>
        {shown ? <ResultAlert tone={shown.tone} lines={shown.lines} /> : null}
      </CardContent>
    </Card>
  )
}
