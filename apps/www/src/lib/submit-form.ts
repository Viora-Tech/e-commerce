import { resetTurnstile } from './turnstile'

export type FormKind = 'contact' | 'changelog'
export type SubmitResult = 'ok' | 'duplicate' | 'error'

type Fields = Record<string, string | string[]>

/**
 * Sends a checked form to the site's Worker (`/api/forms`, worker/index.ts), which verifies the
 * Turnstile token, stores the entry and emails the team. Any failure is 'error': the visitor
 * sees "try again", never a success that did not happen.
 */
export async function submitForm(
  kind: FormKind,
  fields: Fields,
  formData: FormData,
): Promise<SubmitResult> {
  const token = String(formData.get('cf-turnstile-response') ?? '')
  if (!token) return 'error'
  try {
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, fields, token }),
    })
    if (!res.ok) return 'error'
    const body = (await res.json().catch(() => ({}))) as { status?: string }
    if (body.status === 'ok') return 'ok'
    if (body.status === 'duplicate') return 'duplicate'
    return 'error'
  } catch {
    return 'error'
  } finally {
    resetTurnstile()
  }
}
