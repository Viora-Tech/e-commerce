'use server'

import { waitlistContent as copy, WAITLIST_INITIAL, type WaitlistState } from '@/data/waitlist'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const INDIAN_MOBILE = /^[6-9]\d{9}$/

function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get('email') ?? '').trim()
  const phone = normalisePhone(String(formData.get('phone') ?? ''))
  const sell = String(formData.get('sell') ?? '').trim()

  const errors: WaitlistState['errors'] = {}
  if (!EMAIL_PATTERN.test(email)) errors.email = copy.email.invalid
  if (!INDIAN_MOBILE.test(phone)) errors.phone = copy.phone.invalid
  if (sell.length < 2) errors.sell = copy.sell.invalid
  if (Object.keys(errors).length > 0) return { ...WAITLIST_INITIAL, status: 'invalid', errors }

  // TODO(owner): public joinWaitlist endpoint
  // The signed-in onboarding joinWaitlist is not reachable from the public site. Until a public,
  // rate-limited endpoint with bot protection exists, nothing is stored: this stub only validates
  // and reports success so the whole flow (modal, states, thank-you page) can be reviewed.
  return { status: 'success', errors: {} }
}
