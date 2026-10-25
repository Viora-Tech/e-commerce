// Runs in the browser: the site is a static export (Cloudflare Workers static assets), so there
// are no server actions. `useActionState` takes these as plain async functions. Fields are
// checked here for quick feedback and again by the Worker that stores them (submit-form.ts).

import { waitlistContent as copy, WAITLIST_INITIAL, type WaitlistState } from '@/data/waitlist'
import { submitForm } from './submit-form'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get('email') ?? '').trim()
  const sell = String(formData.get('sell') ?? '').trim()
  const channels = formData.getAll('channels').map(String)

  const errors: WaitlistState['errors'] = {}
  if (!EMAIL_PATTERN.test(email)) errors.email = copy.email.invalid
  if (sell.length < 2) errors.sell = copy.sell.invalid
  if (Object.keys(errors).length > 0) return { ...WAITLIST_INITIAL, status: 'invalid', errors }

  const result = await submitForm('waitlist', { email, sell, channels }, formData)
  if (result === 'ok') return { status: 'success', errors: {} }
  if (result === 'duplicate') return { status: 'duplicate', errors: {} }
  return { status: 'error', errors: {} }
}
