/**
 * Razorpay's Affordability Widget, loaded the way their docs describe
 * (https://razorpay.com/docs/payments/payment-gateway/affordability/widget/native-web/):
 * their hosted script, an element with the id `razorpay-affordability-widget`,
 * then `new RazorpayAffordabilitySuite({ key, amount }).render()`. We load
 * Razorpay's own script from their CDN (never copy or vendor it), with the
 * merchant's public key id; offers, lenders and plans come from the merchant's
 * Razorpay account. DOM pieces are passed in so tests run without a browser.
 */

const AFFORDABILITY_SCRIPT_SRC = 'https://cdn.razorpay.com/widgets/affordability/affordability.js'
export const AFFORDABILITY_ELEMENT_ID = 'razorpay-affordability-widget'

type AffordabilitySuite = { render(): void }

declare global {
  interface Window {
    /** Set by Razorpay's affordability script once it loads. */
    RazorpayAffordabilitySuite?:
      | (new (config: {
          key: string
          amount: number
        }) => AffordabilitySuite)
      | undefined
  }
}

type AffordabilityWindow = Pick<Window, 'RazorpayAffordabilitySuite'>

/** The document bits the loader touches. `Document` satisfies it. */
type ScriptHost = {
  querySelector(selector: string): Element | null
  createElement(tag: 'script'): HTMLScriptElement
  head: { appendChild(node: Node): unknown }
}

let loading: Promise<void> | null = null

/** Adds Razorpay's script once per page; every caller shares the one load. A failed load can retry. */
export function loadAffordabilityScript(doc: ScriptHost, win: AffordabilityWindow): Promise<void> {
  if (win.RazorpayAffordabilitySuite) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const existing = doc.querySelector(`script[src="${AFFORDABILITY_SCRIPT_SRC}"]`)
    const script = (existing as HTMLScriptElement | null) ?? doc.createElement('script')
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => {
      loading = null
      reject(new Error('Razorpay affordability script failed to load'))
    })
    if (!existing) {
      script.src = AFFORDABILITY_SCRIPT_SRC
      script.async = true
      doc.head.appendChild(script)
    }
  })
  return loading
}

/** Draws the widget into the element carrying `AFFORDABILITY_ELEMENT_ID`. False when Razorpay's script is missing or throws. */
export function renderAffordability(
  win: AffordabilityWindow,
  config: { key: string; amount: number },
): boolean {
  const Suite = win.RazorpayAffordabilitySuite
  if (!Suite) return false
  try {
    new Suite(config).render()
    return true
  } catch {
    return false
  }
}

/**
 * Razorpay looks the widget up by id, so only one element on the page may
 * hold it. The first block to mount claims it; any other copy (the line
 * under the price and an app block elsewhere) keeps the plain line.
 */
let holder: object | null = null

export function claimAffordabilitySlot(owner: object): boolean {
  if (holder && holder !== owner) return false
  holder = owner
  return true
}

export function releaseAffordabilitySlot(owner: object): void {
  if (holder === owner) holder = null
}

/**
 * Whether the storefront is showing its dark theme: `data-theme="dark"` on
 * <html>, or no explicit theme and the device prefers dark (what the theme
 * toggle and css-variables write).
 */
export function isDarkTheme(
  root: { getAttribute(name: string): string | null },
  prefersDark: boolean,
) {
  const theme = root.getAttribute('data-theme')
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return prefersDark
}
