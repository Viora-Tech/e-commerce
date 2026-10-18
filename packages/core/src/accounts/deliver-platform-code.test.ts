/** SOURCE OF TRUTH: deliverPlatformLoginCode tests — WHAT: admin sign-in codes go through the platform SES account / WHY: they were only logged, never emailed */
import type { Message, NotificationChannel } from '@commerce/notifications'
import { describe, expect, it } from 'vitest'
import { deliverPlatformLoginCode, type PlatformCodeSender } from './deliver-code'

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
      fromEmail: 'no-reply@koomerce.app',
      fromName: 'Koomerce',
      channel: () => channel,
    },
  }
  return { platform, sent }
}

describe('deliverPlatformLoginCode', () => {
  it('emails the code through the platform account', async () => {
    const { platform, sent } = fakePlatform({ ok: true })
    const ok = await deliverPlatformLoginCode(
      { email: 'owner@example.com', code: '482913' },
      platform,
    )
    expect(ok).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.to.email).toBe('owner@example.com')
    expect(sent[0]?.template).toBe('login_code')
    expect(sent[0]?.data.code).toBe('482913')
    expect(sent[0]?.data.storeName).toBe('Koomerce')
  })

  it('answers false when the provider refuses', async () => {
    const { platform } = fakePlatform({ ok: false })
    await expect(
      deliverPlatformLoginCode({ email: 'owner@example.com', code: '482913' }, platform),
    ).resolves.toBe(false)
  })

  it('answers false without a platform account (development)', async () => {
    await expect(
      deliverPlatformLoginCode({ email: 'owner@example.com', code: '482913' }, { transport: null }),
    ).resolves.toBe(false)
  })
})
