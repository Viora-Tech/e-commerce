// Runs in the browser: the site is a static export (Cloudflare Workers static assets), so there
// are no server actions. `useActionState` takes these as plain async functions.

import { waitlistContent as copy, WAITLIST_INITIAL, type WaitlistState } from '@/data/waitlist'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get('email') ?? '').trim()
  const sell = String(formData.get('sell') ?? '').trim()

  const errors: WaitlistState['errors'] = {}
  if (!EMAIL_PATTERN.test(email)) errors.email = copy.email.invalid
  if (sell.length < 2) errors.sell = copy.sell.invalid
  if (Object.keys(errors).length > 0) return { ...WAITLIST_INITIAL, status: 'invalid', errors }

  // TODO(owner): public joinWaitlist endpoint
  // The signed-in onboarding joinWaitlist is not reachable from the public site. Until a public,
  // rate-limited endpoint with bot protection exists, nothing is stored: this stub only validates
  // and reports success so the whole flow (modal, states, thank-you page) can be reviewed.
  return { status: 'success', errors: {} }
}
