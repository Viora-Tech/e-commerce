'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'
import { authClient, authErrorCode } from '@/lib/auth-client'
import { routes } from '@/lib/routes'

const noSubscription = () => () => {}

/** WebAuthn is a browser feature; the server render leaves the button out. */
const browserSupportsPasskeys = () => typeof window.PublicKeyCredential === 'function'

/**
 * "or · Sign in with a passkey" under the email form, for members who added one in Account →
 * Sign-in & security. Hidden where the browser cannot use passkeys.
 */
export default function PasskeySignIn() {
  // Hooks
  const { passkey: copy } = useCopy(loginContent)
  const router = useRouter()
  const supported = useSyncExternalStore(noSubscription, browserSupportsPasskeys, () => false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSignIn = async () => {
    setBusy(true)
    setError(null)
    const res = await authClient.signIn.passkey()
    setBusy(false)
    if (res?.error) {
      // Closing the browser's own prompt is not an error worth a message.
      if (!authErrorCode(res.error).includes('CANCELLED')) setError(copy.failed)
      return
    }
    router.push(routes.home())
    router.refresh()
  }

  // Early returns
  if (!supported) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-caption text-helper" aria-hidden="true">
        <span className="h-px flex-1 bg-hairline" />
        {copy.or}
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={handleSignIn}
        loading={busy}
      >
        {copy.button}
      </Button>
      {error ? <p className="text-caption text-destructive">{error}</p> : null}
    </div>
  )
}
