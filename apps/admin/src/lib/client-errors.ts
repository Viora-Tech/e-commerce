/**
 * The last few errors this browser tab has seen, for "Report a bug": uncaught errors,
 * unhandled promise rejections and `console.error` calls, newest last. Installed once, before
 * the app hydrates (`instrumentation-client.ts`), so hydration errors are caught too. Kept only
 * in memory and only sent when a member presses Send. Never reads the page: no input values,
 * no form state, and objects are logged by their type name only.
 */

const MAX_ERRORS = 20
const MAX_LENGTH = 500

const recent: string[] = []
let installed = false

function describe(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (value === null || value === undefined) return String(value)
  // An object may carry form state or a DOM node; its type name is enough to place the error.
  return `[${(value as object).constructor?.name ?? 'object'}]`
}

function remember(text: string): void {
  recent.push(text.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH))
  if (recent.length > MAX_ERRORS) recent.shift()
}

/** Starts listening. Safe to call more than once; does nothing on the server. */
export function installClientErrorBuffer(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (e) => {
    const where = e.filename ? ` (${e.filename.split('?')[0]}:${e.lineno}:${e.colno})` : ''
    remember(`Error: ${e.error instanceof Error ? describe(e.error) : e.message}${where}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    remember(`Unhandled rejection: ${describe(e.reason)}`)
  })
  const original = console.error
  console.error = (...args: unknown[]) => {
    remember(`console.error: ${args.map(describe).join(' ')}`)
    original.apply(console, args)
  }
}

/** A copy of what has been seen so far, oldest first. */
export function recentClientErrors(): string[] {
  return [...recent]
}
