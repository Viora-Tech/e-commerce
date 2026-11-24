import { describe, expect, it } from 'vitest'
import { checkSesSetup, type SesCheckClientLike } from '../src/check'

const config = {
  region: 'ap-south-1',
  accessKeyId: 'AKIAOFFLINE',
  secretAccessKey: 'offline',
  fromEmail: 'orders@shop.example',
}

const sdkError = (name: string) => Object.assign(new Error(name), { name })

/** Answers each command by its class name; an Error answer is thrown. */
function client(
  answers: Record<string, unknown | ((input: unknown) => unknown)>,
): SesCheckClientLike {
  return {
    async send(cmd) {
      const a = answers[cmd.constructor.name]
      const v = typeof a === 'function' ? (a as (i: unknown) => unknown)(cmd.input) : a
      if (v instanceof Error) throw v
      return v ?? {}
    },
  }
}

describe('checkSesSetup', () => {
  it('passes a production account sending from a verified domain', async () => {
    const r = await checkSesSetup(
      config,
      client({
        GetAccountCommand: { ProductionAccessEnabled: true, SendingEnabled: true },
        GetEmailIdentityCommand: (i: unknown) =>
          (i as { EmailIdentity: string }).EmailIdentity === 'shop.example'
            ? { VerifiedForSendingStatus: true }
            : sdkError('NotFoundException'),
      }),
    )
    expect(r).toEqual({ errors: [], warnings: [] })
  })

  it('warns about sandbox and fails an unverified From address', async () => {
    const r = await checkSesSetup(
      config,
      client({
        GetAccountCommand: { ProductionAccessEnabled: false, SendingEnabled: true },
        GetEmailIdentityCommand: sdkError('NotFoundException'),
      }),
    )
    expect(r).toEqual({ errors: ['from_not_verified'], warnings: ['sandbox'] })
  })

  it('says the keys are wrong and stops there', async () => {
    const r = await checkSesSetup(
      config,
      client({ GetAccountCommand: sdkError('UnrecognizedClientException') }),
    )
    expect(r).toEqual({ errors: ['bad_keys'], warnings: [] })
  })

  it('finds a missing configuration set and paused sending', async () => {
    const r = await checkSesSetup(
      { ...config, configurationSetName: 'shop-events' },
      client({
        GetAccountCommand: { ProductionAccessEnabled: true, SendingEnabled: false },
        GetEmailIdentityCommand: { VerifiedForSendingStatus: true },
        GetConfigurationSetCommand: sdkError('NotFoundException'),
      }),
    )
    expect(r.errors).toEqual(['sending_paused', 'config_set_missing'])
  })
})
