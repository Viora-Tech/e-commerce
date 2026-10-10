/** SOURCE OF TRUTH: member account emails — WHAT: the code to a member's NEW sign-in address, the notice to the OLD one, and the code that confirms deleting their account, all through the platform email account / WHY: Better Auth only calls a hook with the change code; the notice and the deletion code are ours, so a change nobody asked for does not go unnoticed */

import type { PlatformCodeSender } from '../accounts/deliver-code'
import { getPlatformEmail } from '../sender-email/platform'

/** "asha.rao@gmail.com" → "a•••@gmail.com": enough to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return '•••'
  return `${email[0]}•••${email.slice(at)}`
}

function platformChannel(platform: PlatformCodeSender) {
  const transport = platform.transport
  if (!transport) return null
  return {
    name: transport.fromName,
    channel: transport.channel({
      fromEmail: transport.fromEmail,
      fromName: transport.fromName,
      replyTo: undefined,
      using: 'platform',
    }),
  }
}

const NO_ORDER = { customerName: '', totalLabel: '', lines: [], paymentMethodLabel: '' }

/**
 * The one-time code that confirms a member's new sign-in email. False when there is no
 * platform account (development) or the provider refused; the caller decides what to say.
 */
export async function deliverPlatformEmailChangeCode(
  input: { email: string; code: string },
  platform: PlatformCodeSender = getPlatformEmail(),
): Promise<boolean> {
  const sender = platformChannel(platform)
  if (!sender) return false
  const r = await sender.channel.send({
    to: { email: input.email },
    template: 'email_change_code',
    data: { ...NO_ORDER, storeName: sender.name, code: input.code },
  })
  return r.ok
}

/**
 * Tells the old address that the sign-in email changed, naming the new one masked. Best
 * effort: the change already happened, so a refused send is reported, never thrown.
 */
export async function deliverPlatformEmailChanged(
  input: { oldEmail: string; newEmail: string },
  platform: PlatformCodeSender = getPlatformEmail(),
): Promise<'sent' | 'refused' | 'no_transport'> {
  const sender = platformChannel(platform)
  if (!sender) return 'no_transport'
  const r = await sender.channel.send({
    to: { email: input.oldEmail },
    template: 'email_changed',
    data: {
      ...NO_ORDER,
      storeName: sender.name,
      emailChange: { newEmail: maskEmail(input.newEmail) },
    },
  })
  return r.ok ? 'sent' : 'refused'
}

/**
 * The one-time code that confirms deleting a member's account (Account → Profile → Delete my
 * account), to their current sign-in address. False when there is no platform account
 * (development) or the provider refused.
 */
export async function deliverPlatformAccountDeletionCode(
  input: { email: string; code: string },
  platform: PlatformCodeSender = getPlatformEmail(),
): Promise<boolean> {
  const sender = platformChannel(platform)
  if (!sender) return false
  const r = await sender.channel.send({
    to: { email: input.email },
    template: 'account_deletion_code',
    data: { ...NO_ORDER, storeName: sender.name, code: input.code },
  })
  return r.ok
}
