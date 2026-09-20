'use client'

import { BlockStack, Button, Card, Form, FormLayout, Page, Text, TextField } from '@shopify/polaris'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode() {
    setBusy(true)
    setError(null)
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
    setBusy(false)
    if (res.error) return setError(res.error.message ?? 'Could not send the code')
    setStep('otp')
  }

  async function verify() {
    setBusy(true)
    setError(null)
    const res = await authClient.signIn.emailOtp({ email, otp })
    setBusy(false)
    if (res.error) return setError(res.error.message ?? 'Wrong code')
    router.push('/')
    router.refresh()
  }

  return (
    <Page narrowWidth>
      <div style={{ maxWidth: 400, margin: '10vh auto 0' }}>
        <Card>
          <BlockStack gap="400">
            <Text as="h1" variant="headingLg">
              Log in
            </Text>
            {step === 'email' ? (
              <Form onSubmit={sendCode}>
                <FormLayout>
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    error={error ?? undefined}
                    helpText="We will email you a one-time code."
                  />
                  <Button submit variant="primary" loading={busy}>
                    Continue with email
                  </Button>
                </FormLayout>
              </Form>
            ) : (
              <Form onSubmit={verify}>
                <FormLayout>
                  <TextField
                    label={`Code sent to ${email}`}
                    value={otp}
                    onChange={setOtp}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    error={error ?? undefined}
                    helpText="In development the code is printed in the admin server log."
                  />
                  <Button submit variant="primary" loading={busy} disabled={otp.length < 6}>
                    Log in
                  </Button>
                  <Button variant="plain" onClick={() => setStep('email')}>
                    Use a different email
                  </Button>
                </FormLayout>
              </Form>
            )}
          </BlockStack>
        </Card>
      </div>
    </Page>
  )
}
