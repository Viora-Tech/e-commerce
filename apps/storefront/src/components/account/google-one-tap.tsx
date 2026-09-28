'use client'

import { useEffect } from 'react'
import { oneTapNonceAction, oneTapSignInAction } from '@/lib/login-actions'

type GoogleOneTapProps = {
  /** The store's own Google client id; its authorised JavaScript origins list this domain. */
  clientId: string
  returnTo: string
  remember: boolean
}

type OneTapApi = {
  initialize: (config: Record<string, unknown>) => void
  prompt: () => void
  cancel: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: OneTapApi } }
  }
}

/** Google Identity Services (the One Tap client). https://developers.google.com/identity/gsi/web */
const GSI_SRC = 'https://accounts.google.com/gsi/client'

function loadGsi(): Promise<OneTapApi | null> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = () => resolve(window.google?.accounts?.id ?? null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

/**
 * Google's "Continue as …" prompt. The ID token it returns is checked on our server
 * against this store's Google app and a nonce we issued, then signs the shopper in on
 * this domain. Renders nothing itself.
 */
export default function GoogleOneTap({ clientId, returnTo, remember }: GoogleOneTapProps) {
  // Hooks
  useEffect(() => {
    let cancelled = false
    let api: OneTapApi | null = null
    const run = async () => {
      const [gsi, nonce] = await Promise.all([loadGsi(), oneTapNonceAction()])
      if (cancelled || !gsi || !nonce) return
      api = gsi
      gsi.initialize({
        client_id: clientId,
        nonce,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
        itp_support: true,
        callback: (r: { credential?: string }) => {
          if (r.credential) void oneTapSignInAction(r.credential, returnTo, remember)
        },
      })
      gsi.prompt()
    }
    void run()
    return () => {
      cancelled = true
      api?.cancel()
    }
  }, [clientId, returnTo, remember])

  return null
}
