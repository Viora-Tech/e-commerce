import { normaliseMobile } from '@commerce/core/accounts'
import { accountContent } from '@/data/account'

/*
 * The checkout's contact codes, as plain steps so they are tested on their own. They only
 * call the store's existing sign-in actions (`requestPhoneCodeAction`, `verifyPhoneCodeAction`,
 * `requestCodeAction`, `verifyCodeAction`): the same per-number, per-email and per-IP limits,
 * resend lockout and attempt caps as the account page, and the same answer whether or not
 * an account exists. Nothing here adds an endpoint or loosens a limit.
 */

export type PhoneMethod = 'sms' | 'whatsapp'
export type OtpChannel = 'phone' | 'email'

/** Signing in from the checkout comes back to its first step, now as the customer. */
export const OTP_RETURN_TO = '/checkout'

type CodeSent = { ok: boolean; error?: string | undefined }

export type OtpActions = {
  requestPhone: (phone: string, method: PhoneMethod) => Promise<CodeSent & { mobile?: string }>
  requestEmail: (email: string) => Promise<CodeSent & { email?: string }>
  /** Redirects on success, so only a failure comes back. */
  verifyPhone: (
    mobile: string,
    code: string,
    returnTo: string,
  ) => Promise<{ error: string } | undefined>
  verifyEmail: (
    email: string,
    code: string,
    returnTo: string,
  ) => Promise<{ error: string } | undefined>
}

export type OtpRequest = { channel: OtpChannel; phone: string; email: string; method: PhoneMethod }

export type OtpSent = { ok: true; sentTo: string } | { ok: false; error: string; field?: 'phone' }

const errors = accountContent.login.errors

/** Ask for a code. A number that is not an Indian mobile never reaches the server. */
export async function requestOtp(input: OtpRequest, actions: OtpActions): Promise<OtpSent> {
  if (input.channel === 'phone') {
    if (!normaliseMobile(input.phone))
      return { ok: false, error: errors.invalidPhone, field: 'phone' }
    const r = await actions.requestPhone(input.phone, input.method)
    return r.ok
      ? { ok: true, sentTo: r.mobile ?? input.phone }
      : { ok: false, error: r.error ?? errors.invalidPhone }
  }
  const r = await actions.requestEmail(input.email)
  return r.ok
    ? { ok: true, sentTo: r.email ?? input.email }
    : { ok: false, error: r.error ?? errors.invalidEmail }
}

/** Check the code; on success the action signs the shopper in and reloads the checkout. */
export async function verifyOtp(
  input: { channel: OtpChannel; sentTo: string; code: string },
  actions: OtpActions,
): Promise<string | null> {
  if (!/^\d{6}$/.test(input.code)) return errors.invalid
  const r =
    input.channel === 'phone'
      ? await actions.verifyPhone(input.sentTo, input.code, OTP_RETURN_TO)
      : await actions.verifyEmail(input.sentTo, input.code, OTP_RETURN_TO)
  return r?.error ?? null
}
