'use client'

import { CircleAlert, CircleCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import { toast } from 'sonner'
import { gatewayGuides, paymentsSetupContent as setupCopy } from '@/data/payments-setup'
import { api } from '@/lib/api-client'
import GatewayGuide from './gateway-guide'
import RazorpayWebhookFields from './razorpay-webhook-fields'
import type { GatewayId, PaymentsSetup } from './types'

type GatewayConnectFormProps = {
  providerId: GatewayId
  setup: PaymentsSetup
  onConnected: () => void
}

type Mode = 'test' | 'live'
type TestResult = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string }

const copy = setupCopy.connect

/** A fresh webhook secret the merchant pastes into Razorpay. */
function newSecret(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function initialValues(
  providerId: GatewayId,
  saved: Record<string, string>,
): Record<string, string> {
  if (providerId === 'cashfree') {
    return { appId: saved.appId ?? '', secretKey: saved.secretKey ?? '' }
  }
  return {
    keyId: saved.keyId ?? '',
    keySecret: saved.keySecret ?? '',
    webhookSecret: saved.webhookSecret || newSecret(),
  }
}

function initialMode(providerId: GatewayId, saved: Record<string, string>): Mode {
  if (providerId === 'cashfree') return saved.mode === 'live' ? 'live' : 'test'
  return saved.keyId?.startsWith('rzp_live_') ? 'live' : 'test'
}

/** The Razorpay key's own mode, from its prefix; null when it can't tell. */
function keyMode(keyId: string): Mode | null {
  if (keyId.startsWith('rzp_test_')) return 'test'
  if (keyId.startsWith('rzp_live_')) return 'live'
  return null
}

/**
 * Connect a payment company: Test or Live, the 3-step guide with the key
 * boxes inside it, "Test connection", then save. Razorpay also offers one-click
 * "Connect Razorpay" when this deployment has a Razorpay partner app.
 */
export default function GatewayConnectForm({
  providerId,
  setup,
  onConnected,
}: GatewayConnectFormProps) {
  // Hooks
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(providerId, setup.settings.providers[providerId] ?? {}),
  )
  const [mode, setMode] = useState<Mode>(() =>
    initialMode(providerId, setup.settings.providers[providerId] ?? {}),
  )
  const [openedDashboard, setOpenedDashboard] = useState(false)
  const [showKeys, setShowKeys] = useState(!(providerId === 'razorpay' && setup.razorpayOAuth))
  const [test, setTest] = useState<TestResult>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // Helpers
  const fieldsToSend = () => (providerId === 'cashfree' ? { ...values, mode } : values)

  // Event handlers
  const handleField = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value.trim() }))
    setTest({ status: 'idle' })
  }

  const handleMode = (next: string[]) => {
    const picked = next[0]
    if (picked === 'test' || picked === 'live') setMode(picked)
    setTest({ status: 'idle' })
  }

  const handleNewSecret = () => handleField('webhookSecret', newSecret())

  const handleOpenDashboard = () => setOpenedDashboard(true)

  const handleShowKeys = () => setShowKeys(true)

  const handleOAuth = async () => {
    setRedirecting(true)
    try {
      const { url } = await api.payments.razorpayOAuthStart({ mode })
      window.location.href = url
    } catch (err) {
      setRedirecting(false)
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    }
  }

  const handleTest = async () => {
    setTest({ status: 'testing' })
    try {
      const r = await api.payments.testConnection({ providerId, fields: fieldsToSend() })
      setTest({ status: r.ok ? 'ok' : 'error', message: r.message })
    } catch (err) {
      setTest({ status: 'error', message: err instanceof Error ? err.message : copy.saveFailed })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.payments.connect({ providerId, fields: fieldsToSend() })
      toast.success(copy.saved(gatewayGuides[providerId].name))
      onConnected()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const guide = gatewayGuides[providerId]
  const idKey = providerId === 'cashfree' ? 'appId' : 'keyId'
  const secretKey = providerId === 'cashfree' ? 'secretKey' : 'keySecret'
  const filled = !!values[idKey] && !!values[secretKey]
  const detected = providerId === 'razorpay' ? keyMode(values.keyId ?? '') : null
  const mismatch = detected !== null && detected !== mode
  const webhookUrl = setup.webhookUrls[providerId] ?? ''
  const oauth = providerId === 'razorpay' && setup.razorpayOAuth

  const keyBoxes = (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${providerId}-${idKey}`}>{guide.fields[idKey]?.label}</FieldLabel>
        <Input
          size="lg"
          id={`${providerId}-${idKey}`}
          autoComplete="off"
          spellCheck={false}
          placeholder={guide.fields[idKey]?.placeholder}
          value={values[idKey] ?? ''}
          onChange={(e) => handleField(idKey, e.target.value)}
        />
        <FieldDescription>{guide.fields[idKey]?.help}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${providerId}-${secretKey}`}>
          {guide.fields[secretKey]?.label}
        </FieldLabel>
        <Input
          size="lg"
          id={`${providerId}-${secretKey}`}
          type="password"
          autoComplete="off"
          value={values[secretKey] ?? ''}
          onChange={(e) => handleField(secretKey, e.target.value)}
        />
        <FieldDescription>{guide.fields[secretKey]?.help}</FieldDescription>
      </Field>
      {mismatch ? (
        <p className="flex items-center gap-1.5 text-body font-medium text-destructive">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {copy.modeMismatch[mode]}
        </p>
      ) : null}
    </FieldGroup>
  )

  const webhookBoxes =
    providerId === 'razorpay' ? (
      <RazorpayWebhookFields
        url={webhookUrl}
        secret={values.webhookSecret ?? ''}
        onNewSecret={handleNewSecret}
      />
    ) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span id={`${providerId}-mode-label`} className="text-body font-medium text-foreground">
            {copy.mode.label}
          </span>
          <ToggleGroup
            aria-labelledby={`${providerId}-mode-label`}
            value={[mode]}
            onValueChange={handleMode}
            variant="outline"
            spacing={0}
          >
            <ToggleGroupItem value="test">{copy.mode.test}</ToggleGroupItem>
            <ToggleGroupItem value="live">{copy.mode.live}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="text-caption text-muted-foreground">
          {mode === 'test' ? copy.mode.testHelp : copy.mode.liveHelp}
        </p>
      </div>

      {oauth ? (
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            className="w-full gap-2 sm:w-fit"
            onClick={handleOAuth}
            disabled={redirecting}
          >
            {redirecting ? <Spinner /> : null}
            {copy.oneClick(guide.name)}
          </Button>
          <p className="text-caption text-muted-foreground">{copy.oneClickHelp}</p>
          {showKeys ? null : (
            <Button variant="link" className="w-fit px-0" onClick={handleShowKeys}>
              {copy.orKeys}
            </Button>
          )}
        </div>
      ) : null}

      {showKeys ? (
        <>
          <GatewayGuide
            guide={guide}
            done={[openedDashboard || filled, filled, providerId === 'cashfree' || filled]}
            onOpenDashboard={handleOpenDashboard}
            stepTwo={keyBoxes}
            stepThree={webhookBoxes}
          />

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleTest}
                disabled={!filled || test.status === 'testing'}
              >
                {test.status === 'testing' ? <Spinner /> : null}
                {test.status === 'testing' ? copy.testing : copy.testConnection}
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={handleSave}
                disabled={!filled || saving || mismatch}
              >
                {saving ? <Spinner /> : null}
                {saving ? copy.saving : copy.save}
              </Button>
            </div>
            {test.status === 'ok' ? (
              <p className="flex items-center gap-1.5 text-body font-medium text-success">
                <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
                {test.message}
              </p>
            ) : test.status === 'error' ? (
              <p className="flex items-center gap-1.5 text-body font-medium text-destructive">
                <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                {test.message}
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">{copy.testHint}</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
