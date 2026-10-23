/**
 * Meta's JavaScript SDK, loaded once on demand, and WhatsApp Embedded Signup v4 on top of it
 * (developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation).
 *
 * The script is added by our own (nonce-trusted) bundle, so the admin's `strict-dynamic` CSP
 * lets it run without listing Facebook's host. `FB.login` with the Embedded Signup
 * configuration returns a `code`; the popup separately posts a `WA_EMBEDDED_SIGNUP` message
 * with the WhatsApp Business account and phone number ids. Both are needed, in either order.
 */

type FbLoginResponse = { authResponse?: { code?: string } | null; status?: string }

type FbSdk = {
  init: (opts: {
    appId: string
    autoLogAppEvents: boolean
    xfbml: boolean
    version: string
  }) => void
  login: (cb: (r: FbLoginResponse) => void, opts: Record<string, unknown>) => void
}

declare global {
  interface Window {
    FB?: FbSdk
    fbAsyncInit?: () => void
  }
}

const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js'

let loading: Promise<FbSdk> | null = null

function loadSdk(appId: string, version: string): Promise<FbSdk> {
  if (window.FB) return Promise.resolve(window.FB)
  if (loading) return loading
  loading = new Promise<FbSdk>((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (!window.FB) return reject(new Error('sdk'))
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version })
      resolve(window.FB)
    }
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onerror = () => {
      loading = null
      reject(new Error('sdk'))
    }
    document.body.appendChild(script)
  })
  return loading
}

export type EmbeddedSignupResult =
  | { kind: 'done'; code: string; wabaId: string; phoneNumberId: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string | null }

type SessionEvent = {
  type?: string
  event?: string
  data?: { waba_id?: string; phone_number_id?: string; error_message?: string }
}

const FINISH_EVENTS = new Set([
  'FINISH',
  'FINISH_ONLY_WABA',
  'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
  'FINISH_OBO_MIGRATION',
  'FINISH_GRANT_ONLY_API_ACCESS',
])

/** Opens Meta's Embedded Signup popup and resolves once it has both the code and the ids. */
export async function runEmbeddedSignup(input: {
  appId: string
  configId: string
  version: string
}): Promise<EmbeddedSignupResult> {
  const fb = await loadSdk(input.appId, input.version)
  return new Promise<EmbeddedSignupResult>((resolve) => {
    let code: string | null = null
    let ids: { wabaId: string; phoneNumberId: string } | null = null
    let settled = false
    const finish = (r: EmbeddedSignupResult) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      resolve(r)
    }
    const tryDone = () => {
      if (code && ids) finish({ kind: 'done', code, ...ids })
    }
    const onMessage = (event: MessageEvent) => {
      let host = ''
      try {
        host = new URL(event.origin).hostname
      } catch {
        return
      }
      if (host !== 'facebook.com' && !host.endsWith('.facebook.com')) return
      let msg: SessionEvent
      try {
        msg = typeof event.data === 'string' ? (JSON.parse(event.data) as SessionEvent) : event.data
      } catch {
        return
      }
      if (msg?.type !== 'WA_EMBEDDED_SIGNUP') return
      if (msg.event && FINISH_EVENTS.has(msg.event) && msg.data?.waba_id) {
        ids = { wabaId: msg.data.waba_id, phoneNumberId: msg.data.phone_number_id ?? '' }
        tryDone()
      } else if (msg.event === 'CANCEL') {
        finish({ kind: 'cancelled' })
      } else if (msg.event === 'ERROR') {
        finish({ kind: 'error', message: msg.data?.error_message ?? null })
      }
    }
    window.addEventListener('message', onMessage)
    fb.login(
      (response) => {
        const c = response.authResponse?.code
        if (!c) {
          finish({ kind: 'cancelled' })
          return
        }
        code = c
        tryDone()
        // The ids normally arrive first; give a late message a moment before giving up.
        window.setTimeout(() => {
          if (!settled) finish({ kind: 'error', message: null })
        }, 5000)
      },
      {
        config_id: input.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {} },
      },
    )
  })
}
