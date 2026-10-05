/** SOURCE OF TRUTH: staff invitation email — WHAT: sends "You're invited to manage <store>" through the platform email account / WHY: Better Auth only calls a hook; without this the invite was only logged and nobody got it */
import { getPlatformEmail } from '../sender-email/platform'
import type { PlatformCodeSender } from './deliver-code'

export type StaffInviteEmail = {
  /** Who is invited. */
  email: string
  storeName: string
  inviterEmail: string
  /** The store role they will hold, e.g. "Staff". Left out of the email when unknown. */
  roleLabel?: string | undefined
  /** The admin's accept page for this invitation. */
  acceptUrl: string
}

/**
 * Email a staff invitation through the platform account (the one SES account every store sends
 * through; the sender name is PLATFORM_EMAIL_NAME). Invitations come from the platform, not the
 * store's own email app, because the invited person is joining the platform's admin.
 *
 * - `'sent'`: the provider accepted it.
 * - `'refused'`: the provider said no; the caller tells the merchant the email did not go.
 * - `'no_transport'`: no platform account (development); the caller may log the link instead.
 */
export async function deliverPlatformStaffInvite(
  input: StaffInviteEmail,
  platform: PlatformCodeSender = getPlatformEmail(),
): Promise<'sent' | 'refused' | 'no_transport'> {
  const transport = platform.transport
  if (!transport) return 'no_transport'
  const channel = transport.channel({
    fromEmail: transport.fromEmail,
    fromName: transport.fromName,
    replyTo: undefined,
    using: 'platform',
  })
  const r = await channel.send({
    to: { email: input.email },
    template: 'staff_invite',
    data: {
      storeName: input.storeName,
      customerName: '',
      totalLabel: '',
      lines: [],
      paymentMethodLabel: '',
      actionUrl: input.acceptUrl,
      staffInvite: {
        inviterEmail: input.inviterEmail,
        roleLabel: input.roleLabel,
        platformName: transport.fromName,
      },
    },
  })
  return r.ok ? 'sent' : 'refused'
}
