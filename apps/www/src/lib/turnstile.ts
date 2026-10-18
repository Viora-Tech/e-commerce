/**
 * Cloudflare Turnstile, the bot check on the site's forms. The widget renders into the form and
 * adds a hidden `cf-turnstile-response` field; worker/index.ts checks that token before it
 * stores anything. The site key is public (it is in every page anyway); the secret lives only in
 * the Worker (`TURNSTILE_SECRET`).
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFZ81NyZhsJNLIoo'

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: { sitekey: string; action: string; appearance: 'interaction-only' },
  ) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null
const widgets = new Set<string>()

/** Loads the Turnstile script once per page, however many forms ask for it. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('no turnstile'))
    script.onerror = () => {
      loading = null
      reject(new Error('turnstile failed to load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export function trackWidget(id: string) {
  widgets.add(id)
}

export function untrackWidget(id: string) {
  widgets.delete(id)
}

/** A token is good for one submit: after the server has seen it, every widget gets a fresh one. */
export function resetTurnstile() {
  for (const id of widgets) window.turnstile?.reset(id)
}
