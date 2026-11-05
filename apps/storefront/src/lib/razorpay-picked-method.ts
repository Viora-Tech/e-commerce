/*
 * The tab a shopper picked on the Payment step, carried to Razorpay's window. The window keeps
 * every method the store allows; the picked one simply comes first, so a shopper who changes
 * their mind is never stranded.
 */

/** Session storage key: lives for the tab, only ever a method name. */
const PICKED_METHOD_KEY = 'ck-pay-method'

type Block = { name: string; instruments: Record<string, unknown>[] }

/** Razorpay's documented Checkout blocks for each tab on the Payment step. */
const BLOCKS: Record<string, Block> = {
  upi: { name: 'Pay using UPI', instruments: [{ method: 'upi' }] },
  card: { name: 'Cards', instruments: [{ method: 'card' }] },
  netbanking: { name: 'Netbanking', instruments: [{ method: 'netbanking' }] },
  emi: {
    name: 'Pay in EMIs',
    instruments: [{ method: 'emi' }, { method: 'cardless_emi' }, { method: 'paylater' }],
  },
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

/**
 * Razorpay's options with the picked method first. A store that hid some methods keeps exactly
 * that list: a method it hid is never brought back.
 */
export function withPickedMethod(
  options: Record<string, unknown>,
  method: string | null,
): Record<string, unknown> {
  const block = method ? BLOCKS[method] : undefined
  if (!method || !block) return options
  const config = asRecord(options.config)
  const display = asRecord(config.display)
  const blocks = asRecord(display.blocks)
  const preferences = asRecord(display.preferences)
  const limited = preferences.show_default_blocks === false
  if (limited && !blocks[method]) return options
  const name = `block.${method}`
  const others = Array.isArray(display.sequence)
    ? display.sequence.filter((entry) => entry !== name)
    : []
  return {
    ...options,
    config: {
      ...config,
      display: {
        ...display,
        blocks: { ...blocks, [method]: blocks[method] ?? block },
        sequence: [name, ...others],
        preferences: limited ? preferences : { ...preferences, show_default_blocks: true },
      },
    },
  }
}

/** Remember the tab. Storage can be blocked; the window then simply opens as usual. */
export function rememberPickedMethod(method: string): void {
  try {
    window.sessionStorage.setItem(PICKED_METHOD_KEY, method)
  } catch {
    // Nothing to do: the pick is only a convenience.
  }
}

/** The remembered tab, once: it never leaks into a later order. */
export function takePickedMethod(): string | null {
  try {
    const method = window.sessionStorage.getItem(PICKED_METHOD_KEY)
    window.sessionStorage.removeItem(PICKED_METHOD_KEY)
    return method
  } catch {
    return null
  }
}
