import type {
  CreateEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SendEmailCommand,
} from '@aws-sdk/client-sesv2'
import { sampleTemplateData } from '@commerce/notifications/testing'
import { describe, expect, it } from 'vitest'
import { formatMailbox } from '../src/address'
import { identityState, SesIdentityProvider } from '../src/identity'
import { SesChannel } from '../src/ses'

type Sent = { name: string; input: Record<string, unknown> }

/** A fake SES client: records every command and answers from a script. Never reaches AWS. */
function fakeSes(answer: (cmd: Sent) => unknown) {
  const sent: Sent[] = []
  return {
    sent,
    client: {
      async send(command: { constructor: { name: string }; input: object }) {
        const cmd = {
          name: command.constructor.name,
          input: command.input as Record<string, unknown>,
        }
        sent.push(cmd)
        return answer(cmd)
      },
    },
  }
}

const awsError = (name: string) => Object.assign(new Error(name), { name })

const config = { region: 'ap-south-1', accessKeyId: 'AKIAOFFLINE', secretAccessKey: 'offline' }

const pending = {
  DkimAttributes: {
    Status: 'PENDING',
    Tokens: ['aaa', 'bbb', 'ccc'],
    SigningHostedZone: 'dkim.amazonses.com',
  },
  VerifiedForSendingStatus: false,
  VerificationStatus: 'PENDING',
  MailFromAttributes: { MailFromDomain: 'bounce.waimers.in', MailFromDomainStatus: 'PENDING' },
}

describe('SesIdentityProvider', () => {
  it('creates an Easy DKIM domain identity, sets the bounce subdomain and reads the tokens back', async () => {
    const ses = fakeSes((c) => (c.name === 'GetEmailIdentityCommand' ? pending : {}))
    const p = new SesIdentityProvider({ ...config, configurationSetName: 'events' }, ses.client)
    const state = await p.create('waimers.in', { mailFromDomain: 'bounce.waimers.in' })

    expect(ses.sent.map((c) => c.name)).toEqual([
      'CreateEmailIdentityCommand',
      'PutEmailIdentityMailFromAttributesCommand',
      'GetEmailIdentityCommand',
    ])
    const create = ses.sent[0]?.input as unknown as CreateEmailIdentityCommand['input']
    expect(create.EmailIdentity).toBe('waimers.in')
    // No DkimSigningAttributes: that would switch to Bring Your Own DKIM.
    expect(create.DkimSigningAttributes).toBeUndefined()
    expect(create.ConfigurationSetName).toBe('events')
    const mailFrom = ses.sent[1]
      ?.input as unknown as PutEmailIdentityMailFromAttributesCommand['input']
    expect(mailFrom).toEqual({
      EmailIdentity: 'waimers.in',
      MailFromDomain: 'bounce.waimers.in',
      BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
    })
    expect(state).toEqual({
      status: 'pending',
      dkimTokens: ['aaa', 'bbb', 'ccc'],
      dkimHostedZone: 'dkim.amazonses.com',
      mailFrom: { domain: 'bounce.waimers.in', status: 'pending' },
      error: null,
    })
  })

  it('adopts an identity that already exists (a retry after a crash)', async () => {
    const ses = fakeSes((c) => {
      if (c.name === 'CreateEmailIdentityCommand') throw awsError('AlreadyExistsException')
      return c.name === 'GetEmailIdentityCommand' ? pending : {}
    })
    const state = await new SesIdentityProvider(config, ses.client).create('waimers.in', {
      mailFromDomain: null,
    })
    expect(state.status).toBe('pending')
    expect(ses.sent.map((c) => c.name)).toEqual([
      'CreateEmailIdentityCommand',
      'GetEmailIdentityCommand',
    ])
  })

  it('passes other create errors through', async () => {
    const ses = fakeSes(() => {
      throw awsError('LimitExceededException')
    })
    await expect(
      new SesIdentityProvider(config, ses.client).create('waimers.in', { mailFromDomain: null }),
    ).rejects.toThrow('LimitExceededException')
  })

  it('answers null for a missing identity and ignores deleting one', async () => {
    const ses = fakeSes(() => {
      throw awsError('NotFoundException')
    })
    const p = new SesIdentityProvider(config, ses.client)
    expect(await p.get('gone.in')).toBeNull()
    await expect(p.remove('gone.in')).resolves.toBeUndefined()
    expect(ses.sent.at(-1)?.name).toBe('DeleteEmailIdentityCommand')
  })

  it('reports a refused MAIL FROM as false instead of throwing', async () => {
    const ses = fakeSes(() => {
      throw awsError('BadRequestException')
    })
    expect(
      await new SesIdentityProvider(config, ses.client).setMailFrom('w.in', 'bounce.w.in'),
    ).toBe(false)
  })
})

describe('identityState', () => {
  it('maps SES statuses and error types to plain reasons', () => {
    expect(
      identityState({ DkimAttributes: { Status: 'SUCCESS' }, VerifiedForSendingStatus: true }),
    ).toMatchObject({ status: 'verified', error: null, dkimHostedZone: 'dkim.amazonses.com' })
    expect(identityState({ DkimAttributes: { Status: 'TEMPORARY_FAILURE' } }).status).toBe(
      'pending',
    )
    expect(
      identityState({
        DkimAttributes: { Status: 'FAILED' },
        VerificationInfo: { ErrorType: 'HOST_NOT_FOUND' },
      }),
    ).toMatchObject({ status: 'failed', error: 'records_not_found' })
    expect(
      identityState({
        DkimAttributes: { Status: 'PENDING' },
        VerificationInfo: { ErrorType: 'INVALID_VALUE' },
      }).error,
    ).toBe('wrong_value')
    expect(identityState({ DkimAttributes: { Status: 'FAILED' } }).error).toBe('timed_out')
    expect(
      identityState({
        DkimAttributes: { Status: 'PENDING', SigningHostedZone: 'dkim.ap-south-1.amazonses.com' },
      }).dkimHostedZone,
    ).toBe('dkim.ap-south-1.amazonses.com')
  })
})

describe('formatMailbox', () => {
  it('leaves plain names bare, quotes punctuation and encodes non-ASCII', () => {
    expect(formatMailbox('Waimers Store', 'a@w.in')).toBe('Waimers Store <a@w.in>')
    expect(formatMailbox(undefined, 'a@w.in')).toBe('a@w.in')
    expect(formatMailbox('Waimers, Inc. "Pro"', 'a@w.in')).toBe(
      '"Waimers, Inc. \\"Pro\\"" <a@w.in>',
    )
    expect(formatMailbox('वाइमर्स', 'a@w.in')).toBe(
      `=?UTF-8?B?${Buffer.from('वाइमर्स').toString('base64')}?= <a@w.in>`,
    )
  })

  it('cannot be used to inject a header', () => {
    const out = formatMailbox('Shop\r\nBcc: victim@x.com <evil@x.com>', 'a@w.in')
    expect(out).not.toMatch(/[\r\n]/)
    expect(out.endsWith('<a@w.in>')).toBe(true)
    expect(out.match(/</g)).toHaveLength(1)
  })
})

describe('SesChannel reply-to', () => {
  const recorder = () => {
    const sent: SendEmailCommand[] = []
    return {
      sent,
      client: {
        async send(cmd: SendEmailCommand) {
          sent.push(cmd)
          return { MessageId: 'm-1' }
        },
      },
    }
  }

  it('sets Reply-To on order and marketing email only when configured, under its own id', async () => {
    const rec = recorder()
    const ch = new SesChannel(
      {
        ...config,
        fromEmail: 'no-reply@mail.platform.in',
        fromName: 'Waimers',
        replyTo: 'support@waimers.in',
      },
      rec.client,
      { id: 'platform_email' },
    )
    expect(ch.id).toBe('platform_email')
    await ch.send({
      to: { email: 'asha@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    await ch.sendMarketing({
      kind: 'email',
      to: { email: 'asha@example.com' },
      subject: 'Sale',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: [{ name: 'List-Unsubscribe', value: '<https://s.test/u/1>' }],
    })
    expect(rec.sent.map((c) => c.input.ReplyToAddresses)).toEqual([
      ['support@waimers.in'],
      ['support@waimers.in'],
    ])
    // List-Unsubscribe rides on marketing only, never on an order email.
    expect(rec.sent[0]?.input.Content?.Simple?.Headers).toBeUndefined()
    expect(rec.sent[1]?.input.Content?.Simple?.Headers).toEqual([
      { Name: 'List-Unsubscribe', Value: '<https://s.test/u/1>' },
    ])

    const plain = recorder()
    await new SesChannel({ ...config, fromEmail: 'a@w.in' }, plain.client).send({
      to: { email: 'asha@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(plain.sent[0]?.input.ReplyToAddresses).toBeUndefined()
  })
})
