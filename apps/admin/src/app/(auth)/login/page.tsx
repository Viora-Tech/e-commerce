'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@commerce/ui/shadcn/input-otp'
import { Label } from '@commerce/ui/shadcn/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [busy, setBusy] = useState(false)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
    setBusy(false)
    if (error) return toast.error(error.message ?? 'Could not send the code')
    setStep('otp')
    toast.success('Code sent. In dev it is printed in the admin server log.')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await authClient.signIn.emailOtp({ email, otp })
    setBusy(false)
    if (error) return toast.error(error.message ?? 'Wrong code')
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {step === 'email'
              ? 'We will email you a one-time code.'
              : `Enter the 6-digit code sent to ${email}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={sendCode} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy}>
                Send code
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="otp">Code</Label>
                <InputOTP id="otp" maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" disabled={busy || otp.length < 6}>
                Sign in
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep('email')}>
                Use a different email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
