'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'
import { authClient } from '@/lib/auth-client'
import { routes } from '@/lib/routes'

type GoogleSignInProps = {
  /** Better Auth's `?error=` code when Google sign-in came back refused. */
  errorCode: string | null
}

type GoogleCopy = (typeof loginContent)['google']

/** Only the codes we have words for; anything else (or a made-up code) is the generic line. */
function errorMessage(copy: GoogleCopy, code: string | null): string | null {
  if (!code) return null
  return Object.hasOwn(copy.errors, code)
    ? copy.errors[code as keyof GoogleCopy['errors']]
    : copy.failed
}

/**
 * "Continue with Google" above the email form, then "or use your email". Shown only when the
 * admin has a Google client (MERCHANT_GOOGLE_*). Google sends the browser back to the home
 * page, which takes a member with no store to onboarding, as after an email code.
 */
export default function GoogleSignIn({ errorCode }: GoogleSignInProps) {
  // Hooks
  const { google: copy } = useCopy(loginContent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => errorMessage(copy, errorCode))

  // Event handlers
  const handleSignIn = async () => {
    setBusy(true)
    setError(null)
    // On success the browser is already on its way to Google.
    const res = await authClient.signIn.social({
      provider: 'google',
      callbackURL: routes.home(),
      errorCallbackURL: routes.login(),
    })
    if (res.error) {
      setBusy(false)
      setError(copy.failed)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-2.5"
        onClick={handleSignIn}
        loading={busy}
      >
        {/* biome-ignore lint/performance/noImgElement: Google's own mark, unaltered (sign-in branding guidelines) */}
        <img src="/brand/google-g.svg" alt="" aria-hidden="true" className="size-4.5" />
        {copy.button}
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3 text-caption text-helper" aria-hidden="true">
        <span className="h-px flex-1 bg-hairline" />
        {copy.or}
        <span className="h-px flex-1 bg-hairline" />
      </div>
    </div>
  )
}
