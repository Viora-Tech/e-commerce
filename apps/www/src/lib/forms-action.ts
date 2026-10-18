'use server'

import { changelogContent } from '@/data/changelog'
import { contactContent } from '@/data/contact'
import type { FormState } from './form-state'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function subscribeChangelog(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!EMAIL_PATTERN.test(email)) {
    return { status: 'invalid', errors: { email: changelogContent.subscribe.invalid } }
  }
  // TODO(owner): changelog subscription endpoint. Nothing is stored yet; this validates and
  // reports success so the form states can be reviewed.
  return { status: 'success', errors: {} }
}

export async function sendContactMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const copy = contactContent.form
  const errors: Record<string, string> = {}
  if (String(formData.get('name') ?? '').trim().length < 2) errors.name = copy.invalid.name
  if (!EMAIL_PATTERN.test(String(formData.get('email') ?? '').trim()))
    errors.email = copy.invalid.email
  if (String(formData.get('message') ?? '').trim().length < 5) errors.message = copy.invalid.message
  if (formData.get('consent') !== 'on') errors.consent = copy.invalid.consent
  if (Object.keys(errors).length > 0) return { status: 'invalid', errors }
  // TODO(owner): contact form endpoint (email or CRM). Nothing is sent yet; this validates and
  // reports success so the form states can be reviewed.
  return { status: 'success', errors: {} }
}
