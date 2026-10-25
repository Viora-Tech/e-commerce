// Runs in the browser: the site is a static export (Cloudflare Workers static assets), so there
// are no server actions. `useActionState` takes these as plain async functions. Fields are
// checked here for quick feedback and again by the Worker that stores them (submit-form.ts).

import { changelogContent } from '@/data/changelog'
import { contactContent } from '@/data/contact'
import type { FormState } from './form-state'
import { submitForm } from './submit-form'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim()

export async function subscribeChangelog(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, 'email')
  if (!EMAIL_PATTERN.test(email)) {
    return { status: 'invalid', errors: { email: changelogContent.subscribe.invalid } }
  }
  // Already subscribed is still a success for the visitor.
  const result = await submitForm('changelog', { email }, formData)
  return result === 'error' ? { status: 'error', errors: {} } : { status: 'success', errors: {} }
}

export async function sendContactMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const copy = contactContent.form
  const fields = {
    topic: field(formData, 'topic'),
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    store: field(formData, 'store'),
    message: field(formData, 'message'),
    consent: field(formData, 'consent'),
  }
  const errors: Record<string, string> = {}
  if (fields.name.length < 2) errors.name = copy.invalid.name
  if (!EMAIL_PATTERN.test(fields.email)) errors.email = copy.invalid.email
  if (fields.message.length < 5) errors.message = copy.invalid.message
  if (fields.consent !== 'on') errors.consent = copy.invalid.consent
  if (Object.keys(errors).length > 0) return { status: 'invalid', errors }
  const result = await submitForm('contact', fields, formData)
  return result === 'error' ? { status: 'error', errors: {} } : { status: 'success', errors: {} }
}
