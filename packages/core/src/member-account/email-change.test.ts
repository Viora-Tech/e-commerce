/** SOURCE OF TRUTH: member email change email tests — WHAT: the code goes to the new address, the notice to the old one, masked / WHY: a change nobody asked for must not go unnoticed */
import type { Message, NotificationChannel } from '@commerce/notifications'
import { describe, expect, it } from 'vitest'
import type { PlatformCodeSender } from '../accounts/deliver-code'
import { deliverPlatformEmailChangeCode, deliverPlatformEmailChanged } from './email-change'

function fakePlatform(ok: boolean) {
  const sent: Message[] = []
  const channel: NotificationChannel = {
    id: 'platform_email',
    label: 'Email (sent by the platform)',
    requires: 'email',
    async send(message) {
      sent.push(message)
      return ok ? { ok: true, providerRef: 'ses-1' } : { ok: false, error: 'refused' }
    },
  }
  const platform: PlatformCodeSender = {
    transport: { fromEmail: 'no-reply@vioratech.in', fromName: 'Vextro', channel: () => channel },
  }
  return { platform, sent }
}

describe('email change emails', () => {
  it('sends the code to the new address', async () => {
    const { platform, sent } = fakePlatform(true)
    await expect(
      deliverPlatformEmailChangeCode({ email: 'new@example.com', code: '518204' }, platform),
    ).resolves.toBe(true)
    expect(sent[0]).toMatchObject({
      to: { email: 'new@example.com' },
      template: 'email_change_code',
      data: { code: '518204', storeName: 'Vextro' },
    })
  })

  it('tells the old address, naming the new one masked', async () => {
    const { platform, sent } = fakePlatform(true)
    await expect(
      deliverPlatformEmailChanged(
        { oldEmail: 'old@example.com', newEmail: 'asha@gmail.com' },
        platform,
      ),
    ).resolves.toBe('sent')
    expect(sent[0]).toMatchObject({
      to: { email: 'old@example.com' },
      template: 'email_changed',
      data: { emailChange: { newEmail: 'a•••@gmail.com' } },
    })
  })

  it('reports a refusal or a missing account instead of throwing', async () => {
    const { platform } = fakePlatform(false)
    await expect(
      deliverPlatformEmailChanged({ oldEmail: 'old@example.com', newEmail: 'a@b.co' }, platform),
    ).resolves.toBe('refused')
    await expect(
      deliverPlatformEmailChanged(
        { oldEmail: 'old@example.com', newEmail: 'a@b.co' },
        { transport: null },
      ),
    ).resolves.toBe('no_transport')
  })
})
