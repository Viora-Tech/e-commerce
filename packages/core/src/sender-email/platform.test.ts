/** SOURCE OF TRUTH: platform email transport tests — WHAT: SES or Resend primary, fallback on provider errors, own domains only through SES, with both providers mocked / WHY: a provider outage must not stop order email, and no store ever sends as an unverified domain */

import { loadPlatformEmailEnv } from '@commerce/config'
import { sampleTemplateDataByTemplate } from '@commerce/notifications'
import type { SesClientLike } from '@commerce/notifications-ses'
import { describe, expect, it } from 'vitest'
import type { ChosenSender } from './client'
import { platformEmailFromEnv } from './platform'

const FROM = 'no-reply@mail.platform.test'
const SES_KEYS = { SES_REGION: 'ap-south-1', SES_ACCESS_KEY_ID: 'AKIA', SES_SECRET_ACCESS_KEY: 's' }

/** SES recorder: each call pushes the From it was asked to send as; `fail` makes it throw. */
function sesMock(fail?: Error) {
  const from: string[] = []
  return {
    from,
    client: {
      async send(cmd: Parameters<SesClientLike['send']>[0]) {
        from.push(String(cmd.input.FromEmailAddress))
        if (fail) throw fail
        return { MessageId: 'ses-1' }
      },
    },
  }
}

/** Resend mock: records each body; answers 200 with an id, or `status`. */
function resendMock(status = 200) {
  const bodies: { from: string; reply_to?: string }[] = []
  const fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify(status === 200 ? { id: 're-1' } : { name: 'x' }), {
      status,
    })
  }) as typeof globalThis.fetch
  return { bodies, fetch }
}

const env = (extra: Record<string, string>) =>
  loadPlatformEmailEnv({ PLATFORM_EMAIL_FROM: FROM, PLATFORM_EMAIL_NAME: 'Platform', ...extra })

const platformSender: ChosenSender = {
  fromName: 'Shop',
  fromEmail: FROM,
  replyTo: 'hello@shop.example',
  using: 'platform',
}
const ownSender: ChosenSender = {
  fromName: 'Shop',
  fromEmail: 'hello@shop.example',
  replyTo: undefined,
  using: 'own',
}

const message = {
  to: { email: 'shopper@example.com' },
  template: 'order_placed' as const,
  data: sampleTemplateDataByTemplate.order_placed,
}

describe('platformEmailFromEnv', () => {
  it('sends nothing in dev', () => {
    expect(platformEmailFromEnv(env({})).transport).toBeNull()
  })

  it('names the missing keys for the chosen provider and fallback', () => {
    expect(() => platformEmailFromEnv(env({ SENDER_EMAIL_PROVIDER: 'ses' }))).toThrow(/SES_REGION/)
    expect(() => platformEmailFromEnv(env({ SENDER_EMAIL_PROVIDER: 'resend' }))).toThrow(
      /RESEND_API_KEY/,
    )
    expect(() =>
      platformEmailFromEnv(
        env({
          SENDER_EMAIL_PROVIDER: 'resend',
          RESEND_API_KEY: 're_x',
          SENDER_EMAIL_FALLBACK: 'ses',
        }),
      ),
    ).toThrow(/SENDER_EMAIL_FALLBACK=ses/)
    expect(() =>
      platformEmailFromEnv(
        loadPlatformEmailEnv({ SENDER_EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x' }),
      ),
    ).toThrow(/PLATFORM_EMAIL_FROM/)
  })

  it('sends the platform address through Resend when it is the provider', async () => {
    const resend = resendMock()
    const p = platformEmailFromEnv(
      env({ SENDER_EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x' }),
      {
        resendFetch: resend.fetch,
      },
    )
    const ch = p.transport?.channel(platformSender)
    expect(ch?.id).toBe('platform_email')
    expect(await ch?.send(message)).toEqual({ ok: true, providerRef: 're-1' })
    expect(resend.bodies[0]).toMatchObject({
      from: `Shop <${FROM}>`,
      reply_to: 'hello@shop.example',
    })
  })

  it('falls back from SES to Resend on a provider error, not on a rejected message', async () => {
    const throttled = Object.assign(new Error('Rate exceeded'), { name: 'ThrottlingException' })
    const ses = sesMock(throttled)
    const resend = resendMock()
    const keys = {
      SENDER_EMAIL_PROVIDER: 'ses',
      SENDER_EMAIL_FALLBACK: 'resend',
      RESEND_API_KEY: 're_x',
      ...SES_KEYS,
    }
    const p = platformEmailFromEnv(env(keys), { sesClient: ses.client, resendFetch: resend.fetch })
    expect(await p.transport?.channel(platformSender).send(message)).toEqual({
      ok: true,
      providerRef: 'resend:re-1',
    })
    expect(ses.from).toHaveLength(1)

    const rejected = sesMock(Object.assign(new Error('bad'), { name: 'MessageRejected' }))
    const resend2 = resendMock()
    const q = platformEmailFromEnv(env(keys), {
      sesClient: rejected.client,
      resendFetch: resend2.fetch,
    })
    expect((await q.transport?.channel(platformSender).send(message))?.ok).toBe(false)
    expect(resend2.bodies).toHaveLength(0)
  })

  it('falls back from Resend to SES when Resend is down', async () => {
    const ses = sesMock()
    const resend = resendMock(503)
    const p = platformEmailFromEnv(
      env({
        SENDER_EMAIL_PROVIDER: 'resend',
        SENDER_EMAIL_FALLBACK: 'ses',
        RESEND_API_KEY: 're_x',
        ...SES_KEYS,
      }),
      { sesClient: ses.client, resendFetch: resend.fetch },
    )
    expect(await p.transport?.channel(platformSender).send(message)).toEqual({
      ok: true,
      providerRef: 'ses:ses-1',
    })
  })

  it('sends a verified store domain through SES even when Resend is the provider', async () => {
    const ses = sesMock()
    const resend = resendMock()
    const p = platformEmailFromEnv(
      env({ SENDER_EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x', ...SES_KEYS }),
      { sesClient: ses.client, resendFetch: resend.fetch },
    )
    expect(p.identities.id).toBe('ses')
    expect(await p.transport?.channel(ownSender).send(message)).toEqual({
      ok: true,
      providerRef: 'ses-1',
    })
    expect(ses.from).toEqual(['Shop <hello@shop.example>'])
    expect(resend.bodies).toHaveLength(0)
  })

  it('names the configuration set and tags SES sends with the store, for bounce handling', async () => {
    const inputs: Record<string, unknown>[] = []
    const client = {
      async send(cmd: Parameters<SesClientLike['send']>[0]) {
        inputs.push(cmd.input as Record<string, unknown>)
        return { MessageId: 'ses-1' }
      },
    }
    const store = '7d3c1c52-0b9e-4a52-9a43-2d3c64a1f0aa'
    const p = platformEmailFromEnv(
      env({ SENDER_EMAIL_PROVIDER: 'ses', SES_CONFIGURATION_SET: 'events', ...SES_KEYS }),
      { sesClient: client },
    )
    await p.transport?.channel(ownSender, { storeId: store }).send(message)
    await p.transport?.channel(platformSender, { storeId: store }).send(message)
    await p.transport?.channel(platformSender).send(message)
    expect(inputs.map((i) => i.ConfigurationSetName)).toEqual(['events', 'events', 'events'])
    expect(inputs.map((i) => i.EmailTags)).toEqual([
      [{ Name: 'store-id', Value: store }],
      [{ Name: 'store-id', Value: store }],
      undefined,
    ])
  })

  it('falls back for a store domain from the platform address, Reply-To the shop', async () => {
    const down = Object.assign(new Error('paused'), { name: 'SendingPausedException' })
    const ses = sesMock(down)
    const resend = resendMock()
    const p = platformEmailFromEnv(
      env({
        SENDER_EMAIL_PROVIDER: 'ses',
        SENDER_EMAIL_FALLBACK: 'resend',
        RESEND_API_KEY: 're_x',
        ...SES_KEYS,
      }),
      { sesClient: ses.client, resendFetch: resend.fetch },
    )
    expect((await p.transport?.channel(ownSender).send(message))?.ok).toBe(true)
    expect(resend.bodies[0]).toMatchObject({
      from: `Shop <${FROM}>`,
      reply_to: 'hello@shop.example',
    })
  })

  it('without SES keys, refuses store domains and sends them from the platform address', async () => {
    const resend = resendMock()
    const p = platformEmailFromEnv(
      env({ SENDER_EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x' }),
      {
        resendFetch: resend.fetch,
      },
    )
    await expect(p.identities.create('shop.example', { mailFromDomain: null })).rejects.toThrow(
      /SES/,
    )
    expect(await p.identities.get('shop.example')).toBeNull()
    expect(await p.identities.setMailFrom('shop.example', 'bounce.shop.example')).toBe(false)
    await p.identities.remove('shop.example')
    await p.transport?.channel(ownSender).send(message)
    expect(resend.bodies[0]).toMatchObject({
      from: `Shop <${FROM}>`,
      reply_to: 'hello@shop.example',
    })
  })

  it('ignores a fallback that names the provider itself', async () => {
    const resend = resendMock(503)
    const p = platformEmailFromEnv(
      env({
        SENDER_EMAIL_PROVIDER: 'resend',
        SENDER_EMAIL_FALLBACK: 'resend',
        RESEND_API_KEY: 're_x',
      }),
      { resendFetch: resend.fetch },
    )
    expect(await p.transport?.channel(platformSender).send(message)).toMatchObject({ ok: false })
    expect(resend.bodies).toHaveLength(1)
  })
})
