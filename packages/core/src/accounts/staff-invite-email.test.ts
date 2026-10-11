/** SOURCE OF TRUTH: staff invitation email tests — sent, refused and no platform account, with a fake transport (never real SES) */
import type { Message, NotificationChannel } from '@commerce/notifications'
import { describe, expect, it } from 'vitest'
import type { PlatformCodeSender } from './deliver-code'
import { deliverPlatformStaffInvite } from './staff-invite-email'

function fakePlatform(result: { ok: boolean }) {
  const sent: Message[] = []
  const channel: NotificationChannel = {
    id: 'platform_email',
    label: 'Email (sent by the platform)',
    requires: 'email',
    async send(message) {
      sent.push(message)
      return result.ok ? { ok: true, providerRef: 'ses-1' } : { ok: false, error: 'refused' }
    },
  }
  const platform: PlatformCodeSender = {
    transport: {
      fromEmail: 'no-reply@vioratech.in',
      fromName: 'Sellverse',
      channel: () => channel,
    },
  }
  return { platform, sent }
}

const invite = {
  email: 'helper@example.com',
  storeName: 'Waimers',
  inviterEmail: 'owner@example.com',
  roleLabel: 'Staff',
  acceptUrl: 'https://admin.example/accept-invitation/inv-1',
}

describe('deliverPlatformStaffInvite', () => {
  it('emails the invitation through the platform account', async () => {
    const { platform, sent } = fakePlatform({ ok: true })
    await expect(deliverPlatformStaffInvite(invite, platform)).resolves.toBe('sent')
    expect(sent).toHaveLength(1)
    const m = sent[0]
    expect(m?.to.email).toBe('helper@example.com')
    expect(m?.template).toBe('staff_invite')
    expect(m?.data.storeName).toBe('Waimers')
    expect(m?.data.actionUrl).toBe('https://admin.example/accept-invitation/inv-1')
    expect(m?.data.staffInvite).toEqual({
      inviterEmail: 'owner@example.com',
      roleLabel: 'Staff',
      platformName: 'Sellverse',
    })
  })

  it('answers refused when the provider says no', async () => {
    const { platform } = fakePlatform({ ok: false })
    await expect(deliverPlatformStaffInvite(invite, platform)).resolves.toBe('refused')
  })

  it('answers no_transport without a platform account (development)', async () => {
    await expect(deliverPlatformStaffInvite(invite, { transport: null })).resolves.toBe(
      'no_transport',
    )
  })
})
