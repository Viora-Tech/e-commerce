/** SOURCE OF TRUTH: SNS signature, SES feedback parsing and the SES webhook's decisions — WHAT: signed fixtures (no AWS call, no private key in the repo) through every refusal and the confirmation / WHY: the webhook is public, so each check that keeps forged messages out needs a test */
import type { Db } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { parseSesFeedback } from './ses-feedback'
import { parseSnsEnvelope, snsSubscribeUrlAllowed, verifySnsMessage } from './sns'
import { handleSesSnsWebhook, type SesWebhookDeps } from './webhook'

/**
 * SNS messages signed offline with a throwaway key whose self-signed certificate is below; the
 * private key was discarded, so these signatures are the only thing it ever made. TEST ONLY.
 * Regenerate with a fresh key (openssl req -x509 -newkey rsa:2048 -subj /CN=sns.amazonaws.com)
 * if a test needs a new message.
 */
const F = {
  topic: 'arn:aws:sns:ap-south-1:123456789012:ses-events',
  certUrl:
    'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-9c6465fa7f48f5cacd23014631ec1136.pem',
  store: '7d3c1c52-0b9e-4a52-9a43-2d3c64a1f0aa',
  cert: '-----BEGIN CERTIFICATE-----\r\nMIIDGzCCAgOgAwIBAgIUM9rIYvaTIhYsN+8aYjy0IPt+hoEwDQYJKoZIhvcNAQEL\r\nBQAwHDEaMBgGA1UEAwwRc25zLmFtYXpvbmF3cy5jb20wIBcNMjYxMTExMTgzMDQ0\r\nWhgPMjEyNjEwMTgxODMwNDRaMBwxGjAYBgNVBAMMEXNucy5hbWF6b25hd3MuY29t\r\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkImCDYCDIWNS6ftProZu\r\nFxOChXa9aSjbxvfjSy+WSR1uWVQVIxM3/ImVL8AYJNTonETB6/TWpiT30RuBq6iy\r\nFjBwG5eQkhoaMgA+mF7l0u0S7PxLkTdQCoSjtvQ3+CcIeW9LWnSx/yDFn8JYyKBR\r\nkUEciOqhDnylzqOEC7fJk+3TirWqvOHNbs+RkQdZF8Adxs/kJr+Br55EuhFzu2E8\r\nLtI0GoODf6vuDEAksp1ZZQvXR7wsgsoOhLjXcyCfKPYBc+2ghGrxC8FDnBcPBGmk\r\nSZV5u2jXjhjuoPLqV/LH8qMk9LaoJUYp/tUWvNAMDiEhAWc30gu4sm5hzcRJUvJD\r\nDQIDAQABo1MwUTAdBgNVHQ4EFgQUU9sN1v7LaThsVI0r3KG04riWoY4wHwYDVR0j\r\nBBgwFoAUU9sN1v7LaThsVI0r3KG04riWoY4wDwYDVR0TAQH/BAUwAwEB/zANBgkq\r\nhkiG9w0BAQsFAAOCAQEAHmHaKHmxhrkoSRh7aWO1ATS62rOC0mqdA7jb2BNvbyuH\r\n3TPTaB+qk6Nreb/rdyhh5Dbu9Mvk6gD6UzzwdZDSuscPqgToa78Z6raufBtzBsVu\r\nervlF2TbKTDFHY10qPXDtUB+NlVQTBnXasbN4e04+fOJdbvUdLZ6jD+zaqlfotss\r\naiKUgkQRp0W4274ccphyZuXTJutqsbEiPE0jZvdTNrmNXtfRbzWefNES7i7yjs+R\r\nLDVaa/P0gad0DuwaEmBog8Vf4SRMMxkFanT30sRfrrcsmcFHc4gi/F+mHe1abh8L\r\nh8TKIpFWPVO1g0Vh501/Cw9EUnRtMqjh1S8X+zSmHg==\r\n-----END CERTIFICATE-----\r\n',
  otherCert:
    '-----BEGIN CERTIFICATE-----\r\nMIIDGTCCAgGgAwIBAgIUQYbmaPi5FHfTK7QGE84UNEY3PNAwDQYJKoZIhvcNAQEL\r\nBQAwGzEZMBcGA1UEAwwQYXR0YWNrZXIuZXhhbXBsZTAgFw0yNjExMTExODMwNDRa\r\nGA8yMTI2MTAxODE4MzA0NFowGzEZMBcGA1UEAwwQYXR0YWNrZXIuZXhhbXBsZTCC\r\nASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJu8YZX9qN3P++AxXXjx7eR0\r\nD/VmLkMjuU8nbAGGHZBIaakkWcN7WlYKn4QAU+Dgrbpb7TOPwG6nfISfPzmDHl8u\r\nLknTR06MSGzw5bmlhqOAFraSg4cZxBWuxfHewR4xDwZj8O6LaXrqEEFEgaO8dOOa\r\ngaTrUEe1Q/fe0dYhdM6q4KWLgr1LKhyYmWnL2nQtG6Dd4Mus4E+EetKZ8QsMNkpL\r\nntxrM1Eb2Ra9jkXxrX47LxL4CZkN84/4CO3bwTj5fEtaDW9qZQp6OdZql0B4iGG7\r\nIMc6Oh3qLdcd/+4bvdCZvnz3v8Ax2t5bvl1V8A1yV/2V0VeEESbWZqyR81eiLlUC\r\nAwEAAaNTMFEwHQYDVR0OBBYEFMnYjQow9p3aody/fIXYoC9ctpUiMB8GA1UdIwQY\r\nMBaAFMnYjQow9p3aody/fIXYoC9ctpUiMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZI\r\nhvcNAQELBQADggEBAAjfvWEL0GzZaM4Jiw6s/b2mxkCPA8uQxRS0WysoP0bj9F+9\r\nKmIjud41cEVwWht2mBeIKpO0hr9JFF5kitphHNiW7RDcrDex0Un26IBb1aPYhFbx\r\nZ3Smh2yuoFEync/JEtN2ImttFdB5bRyXzMniLVcPItMUE83H/wAY0QOept0VYiat\r\nVkwK16u4QJBddsnZPe9x12v/B7dJ23qyys9MlntcjSPXnbzbedy/Cuc7ACFJN177\r\nzc67GwZ5jKfpZy5pNEYu7/zxImTsKV/zgBXlJ2rLKDio8QFpFWuS05FBtCsvW4uk\r\nXCQXEpIONJV7Zfdn9sBeUi7VZ5l6c79kd/6udJQ=\r\n-----END CERTIFICATE-----\r\n',
  hardBounceV1: {
    Type: 'Notification',
    MessageId: 'sns-1',
    TopicArn: 'arn:aws:sns:ap-south-1:123456789012:ses-events',
    Message:
      '{"eventType":"Bounce","bounce":{"bounceType":"Permanent","bounceSubType":"General","bouncedRecipients":[{"emailAddress":"Asha <Asha@Example.com>","diagnosticCode":"smtp; 550 5.1.1 user unknown"}],"timestamp":"2026-11-12T05:00:00.000Z"},"mail":{"messageId":"ses-msg-1","source":"Shop <hello@shop.example>","tags":{"store-id":["7d3c1c52-0b9e-4a52-9a43-2d3c64a1f0aa"],"ses:from-domain":["shop.example"]}}}',
    Timestamp: '2026-11-12T05:00:01.000Z',
    SignatureVersion: '1',
    Signature:
      'QH+Fk8bv6/DGK3V9oxtyalFtqYvPAmWcV0KE6e5bVzrwzN5SOhfXggpsNATJYwqa1nkSlqMSCkxDr3SBSTT1gR41GEeCMUa28BuXhH12AF33gizZWJ94z2uUxVUFdU6mAKFtNCm6BKytnkjWfB9qRGqlPaTKlNH3s7dxZT0cVHE+7iu//6hm4C2x7Rs8ss3eQSrBOgSG7U1imDWjO29rZAlr1WPenElJHTtAH3RH0SUMQoEyO9zroLCALwQSajhCa/5ieR+1AE/IW+9TWRSHkL/Zj+Ksc9K2i+x9ckw3v3r8xHDAk6x0wsjCngNj1miEXW8Ec5Gb/vuoBAWpCjOS+A==',
    SigningCertURL:
      'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-9c6465fa7f48f5cacd23014631ec1136.pem',
  },
  softBounceV2: {
    Type: 'Notification',
    MessageId: 'sns-2',
    TopicArn: 'arn:aws:sns:ap-south-1:123456789012:ses-events',
    Subject: 'Amazon SES Email Event Notification',
    Message:
      '{"eventType":"Bounce","bounce":{"bounceType":"Transient","bounceSubType":"MailboxFull","bouncedRecipients":[{"emailAddress":"Asha <Asha@Example.com>","diagnosticCode":"smtp; 550 5.1.1 user unknown"}],"timestamp":"2026-11-12T05:00:00.000Z"},"mail":{"messageId":"ses-msg-1","source":"Shop <hello@shop.example>","tags":{"store-id":["7d3c1c52-0b9e-4a52-9a43-2d3c64a1f0aa"],"ses:from-domain":["shop.example"]}}}',
    Timestamp: '2026-11-12T05:00:02.000Z',
    SignatureVersion: '2',
    Signature:
      'XLLqtluTQkt0VIP/QXle/FidBcBj8KjXGJQuTlQ2zCkwFrHvh2vhfNtK76NI0VhXK7gp1v/haWQo82NL6HqZdPXVs4SF0OO2dXcpUFl/wzAdpE+hYKwxfEt/GEzpqlibYSxMMGu5lkPgvfbdb7/L9VWl9JAvA1T7W0uAQd1PcyCfXXxxK+moev7kcwCpEf3v5ORyxGj+LNBosPjCZHP6lMWVJFEv8Aa3THS75tw5JM7DYL5wjH8aypy/9bCYf1cfGVsaG5lqwIH4eJDLmdE7DfOAm1WhwBFeSK421YRchPsK0smTspYUNhkFdo4rOpucJ4E7Z5q9TUVKOeV6NFqgug==',
    SigningCertURL:
      'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-9c6465fa7f48f5cacd23014631ec1136.pem',
  },
  complaintV2: {
    Type: 'Notification',
    MessageId: 'sns-3',
    TopicArn: 'arn:aws:sns:ap-south-1:123456789012:ses-events',
    Message:
      '{"notificationType":"Complaint","complaint":{"complainedRecipients":[{"emailAddress":"asha@example.com"}],"complaintFeedbackType":"abuse"},"mail":{"messageId":"ses-msg-2","source":"hello@shop.example"}}',
    Timestamp: '2026-11-12T05:00:03.000Z',
    SignatureVersion: '2',
    Signature:
      'X6K0op1mIUyOn8YgDFXitfMwLayvhEZowHo/1lYVvL/NPdmnP5DOLm2dNwRNqtC5xWTTaWdEs38InhaTJ5yFs67XFiIwJIIQvOMNZ4+5IwPI9QDMCpFJJ6XevzuxMCar8k1v59L50ZB/NF+/1AwwlUytU2oifnN890EWo7C7mfi0DKQbqKEjuQRVDptLWqDa9po1EZvCjpAErEii5L4pHM8M/ZBUQyE9ZHk7C8VMnGcrarxzqsl6L8F/iHcRk+RhZTACszXte28cQACJB2Wa9FojsiRYfWty4pP+4x9J1BzzS919XZHjt2RdA7LjjswdpAikJqe7WvViir7PjJH8Gw==',
    SigningCertURL:
      'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-9c6465fa7f48f5cacd23014631ec1136.pem',
  },
  deliveryV2: {
    Type: 'Notification',
    MessageId: 'sns-4',
    TopicArn: 'arn:aws:sns:ap-south-1:123456789012:ses-events',
    Message: '{"eventType":"Delivery","mail":{"messageId":"x"}}',
    Timestamp: '2026-11-12T05:00:04.000Z',
    SignatureVersion: '2',
    Signature:
      'hU16sxR3kDDR6A7aGBxbhdWK7pdWqWHYaz+GJo8YWZ79dW/xIzIyz6wEj6PpyYboFzN8aBHfpnmaAewlfsKvZWXiC9iiYjiD+nz0Z/CCBbtSrQ/UBlRBZjOSRDLvRnMq9FbfnfhFD/Rz/Rqvsgp/nxy1mD0+2lCGpFwLbGhDGXK+mZ3CKWn6s1J2KO+mZBUhsKpymYro8us/oYwL1TEJ53vyLNXtt6epFIhvUTOQ8ljJkUpqzq/n0Q6rFbGvoM5lZjtJ2kFw8kEAFYz7HnIwFSYkH4/KI6E3sLj9Axr0vR592x+CaGIsCeYfooxZbJND1w5KOhWGvWwHAyVqHfjiAA==',
    SigningCertURL:
      'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-9c6465fa7f48f5cacd23014631ec1136.pem',
  },
  subscriptionV2: {
    Type: 'SubscriptionConfirmation',
    MessageId: 'sns-5',
    TopicArn: 'arn:aws:sns:ap-south-1:123456789012:ses-events',
    Message: 'You have chosen to subscribe to the topic.',
    Token: 'tok-123',
    SubscribeURL:
      'https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=arn%3Aaws%3Asns%3Aap-south-1%3A123456789012%3Ases-events&Token=tok-123',
    Timestamp: '2026-11-12T05:00:05.000Z',
    SignatureVersion: '2',
    Signature:
      'iFsYPRoNoXMWCtWtzwSO7xKAjd+An7Yf1xUUqF/TSV7rq0p9GKSTmcCcLQOt2mA9o0hZdM5BWmQtUYS06v6FMi67Rs7nsrwupCiBJCeWcrTMHmscaBYcW8FlMAdqDr2PJujRvP6XghGC5HiKIFx3OjYNVWzKTovUq7fUdaiGTeEn0O5cCBF6Vail3LA5CDzdX9PElBZ31Lzm1rCcSywLSIpgEKMi6aAP5nJMFihClwovczycyPn1cRfKRNnkJNuBazrfq3vbkjErn8YtkfifGiagWlB/qzK+Nm/Ac3N0A5AXfV5fERxHa51DvOtGA3dvYZYce1P/an2pd02pWfFT3w==',
    SigningCertURL:
      'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-9c6465fa7f48f5cacd23014631ec1136.pem',
  },
  evilSubscriptionV2: {
    Type: 'SubscriptionConfirmation',
    MessageId: 'sns-6',
    TopicArn: 'arn:aws:sns:ap-south-1:123456789012:ses-events',
    Message: 'You have chosen to subscribe to the topic.',
    Token: 'tok-123',
    SubscribeURL: 'https://evil.example/?Action=ConfirmSubscription',
    Timestamp: '2026-11-12T05:00:06.000Z',
    SignatureVersion: '2',
    Signature:
      'H7S6AKkZrAjKGYeVlXo9iCqd4EzOY1XLlIh5HyKqutvsRA6o3IpP0O+2B9H+10a664cRMs5WtdODYVMZ6aNDBVzQ/n0wo24KSIbblQmzw75YDiwoqE3MhSONRNXnJ1lv2kjW70simvQQd6TnFovnPRBPuRLQVVa66sKRjz/sEdYBkItppIqDQNkGxv90RUOFxv43qXUUfAio49FnBhGX33HqTO+L8rnWhqXR7uFAQOIa7ydvgK7kE44Ssg1WE6st0EFpaPEY2M6c/y+1/uCZkxWGXtoKX2BkniE7Gry0Egi0AWNKkHKfIrzqq7sMrVbSISEQckRU6utVInx4gnEGAw==',
    SigningCertURL:
      'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-9c6465fa7f48f5cacd23014631ec1136.pem',
  },
}

type Fixture = Record<string, string>

const NOW = new Date('2026-11-12T06:00:00Z')

/** A cert fetcher answering from a table, counting calls; never the network. */
function certs(table: Record<string, string>) {
  const asked: string[] = []
  const fetchCert = async (url: string) => {
    asked.push(url)
    const pem = table[url]
    if (!pem) throw new Error('no such cert')
    return pem
  }
  return { asked, fetchCert }
}

const goodCerts = () => certs({ [F.certUrl]: F.cert })
const body = (m: Fixture) => JSON.stringify(m)

/** A Db that fails the test if anything touches it. */
const noDb = new Proxy(
  {},
  {
    get() {
      throw new Error('the database must not be used here')
    },
  },
) as Db

describe('parseSnsEnvelope', () => {
  it('reads a notification and refuses anything that is not one', () => {
    expect(parseSnsEnvelope(body(F.hardBounceV1))?.MessageId).toBe('sns-1')
    expect(parseSnsEnvelope('not json')).toBeNull()
    expect(parseSnsEnvelope('[]')).toBeNull()
    expect(parseSnsEnvelope(body({ ...F.hardBounceV1, Type: 'Other' }))).toBeNull()
    expect(parseSnsEnvelope(body({ ...F.hardBounceV1, SignatureVersion: '3' }))).toBeNull()
    const { Signature: _s, ...unsigned } = F.hardBounceV1
    expect(parseSnsEnvelope(body(unsigned))).toBeNull()
    // A confirmation needs its SubscribeURL and Token.
    const { Token: _t, ...noToken } = F.subscriptionV2
    expect(parseSnsEnvelope(body(noToken))).toBeNull()
    expect(parseSnsEnvelope(' '.repeat(300 * 1024))).toBeNull()
  })
})

describe('snsSubscribeUrlAllowed', () => {
  it('only visits ConfirmSubscription on an https SNS host', () => {
    expect(snsSubscribeUrlAllowed(F.subscriptionV2.SubscribeURL as string)).toBe(true)
    for (const url of [
      'http://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription',
      'https://sns.ap-south-1.amazonaws.com.evil.example/?Action=ConfirmSubscription',
      'https://evil.example/?Action=ConfirmSubscription',
      'https://user:pw@sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription',
      'https://sns.ap-south-1.amazonaws.com:8443/?Action=ConfirmSubscription',
      'https://sns.ap-south-1.amazonaws.com/?Action=Unsubscribe',
      'https://s3.amazonaws.com/?Action=ConfirmSubscription',
      'not a url',
    ]) {
      expect(snsSubscribeUrlAllowed(url)).toBe(false)
    }
  })
})

describe('verifySnsMessage', () => {
  it('accepts SignatureVersion 1 (SHA1) and 2 (SHA256) signed by the SNS certificate', async () => {
    for (const m of [F.hardBounceV1, F.softBounceV2, F.subscriptionV2]) {
      const env = parseSnsEnvelope(body(m))
      if (!env) throw new Error('fixture did not parse')
      expect(await verifySnsMessage(env, { fetchCert: goodCerts().fetchCert, now: NOW })).toEqual({
        ok: true,
      })
    }
  })

  it('refuses a message changed after signing', async () => {
    const env = parseSnsEnvelope(body({ ...F.hardBounceV1, Message: '{"eventType":"Bounce"}' }))
    if (!env) throw new Error('fixture did not parse')
    expect(await verifySnsMessage(env, { fetchCert: goodCerts().fetchCert, now: NOW })).toEqual({
      ok: false,
      reason: 'signature',
    })
  })

  it('never fetches a certificate from outside amazonaws.com SNS hosts', async () => {
    const c = goodCerts()
    for (const url of [
      'https://evil.example/cert.pem',
      'http://sns.ap-south-1.amazonaws.com/cert.pem',
      'https://sns.ap-south-1.amazonaws.com.evil.example/cert.pem',
      'https://sns.ap-south-1.amazonaws.com/cert.txt',
      'https://s3.ap-south-1.amazonaws.com/cert.pem',
    ]) {
      const env = parseSnsEnvelope(body({ ...F.hardBounceV1, SigningCertURL: url }))
      if (!env) throw new Error('fixture did not parse')
      expect(await verifySnsMessage(env, { fetchCert: c.fetchCert, now: NOW })).toEqual({
        ok: false,
        reason: 'cert_url',
      })
    }
    expect(c.asked).toEqual([])
  })

  it('refuses a signature the served certificate did not make, and an expired certificate', async () => {
    const url = 'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-other.pem'
    const env = parseSnsEnvelope(body({ ...F.softBounceV2, SigningCertURL: url }))
    if (!env) throw new Error('fixture did not parse')
    const c = certs({ [url]: F.otherCert })
    expect(await verifySnsMessage(env, { fetchCert: c.fetchCert, now: NOW })).toEqual({
      ok: false,
      reason: 'signature',
    })
    const good = parseSnsEnvelope(body(F.softBounceV2))
    if (!good) throw new Error('fixture did not parse')
    expect(
      await verifySnsMessage(good, {
        fetchCert: goodCerts().fetchCert,
        now: new Date('2200-01-01T00:00:00Z'),
      }),
    ).toEqual({ ok: false, reason: 'cert_invalid' })
  })

  it('reports a certificate it could not fetch or read', async () => {
    const url = 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-missing.pem'
    const env = parseSnsEnvelope(body({ ...F.softBounceV2, SigningCertURL: url }))
    if (!env) throw new Error('fixture did not parse')
    expect(await verifySnsMessage(env, { fetchCert: certs({}).fetchCert, now: NOW })).toEqual({
      ok: false,
      reason: 'cert_fetch',
    })
    const junk = 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-junk.pem'
    const env2 = parseSnsEnvelope(body({ ...F.softBounceV2, SigningCertURL: junk }))
    if (!env2) throw new Error('fixture did not parse')
    expect(
      await verifySnsMessage(env2, {
        fetchCert: certs({ [junk]: 'not a pem' }).fetchCert,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: 'cert_invalid' })
  })
})

describe('parseSesFeedback', () => {
  it('reads a configuration-set bounce with its store tag and the bare address', () => {
    expect(parseSesFeedback(F.hardBounceV1.Message as string)).toEqual({
      kind: 'bounce',
      bounceType: 'Permanent',
      subType: 'General',
      recipients: [{ email: 'asha@example.com', detail: 'smtp; 550 5.1.1 user unknown' }],
      sesMessageId: 'ses-msg-1',
      storeTag: F.store,
      fromDomain: 'shop.example',
    })
  })

  it('reads an identity-notification complaint with no tags (store found by domain)', () => {
    expect(parseSesFeedback(F.complaintV2.Message as string)).toEqual({
      kind: 'complaint',
      bounceType: null,
      subType: 'abuse',
      recipients: [{ email: 'asha@example.com', detail: 'abuse' }],
      sesMessageId: 'ses-msg-2',
      storeTag: null,
      fromDomain: 'shop.example',
    })
  })

  it('ignores deliveries, junk, bad tags and recipients that are not addresses', () => {
    expect(parseSesFeedback(F.deliveryV2.Message as string)).toBeNull()
    expect(parseSesFeedback('nope')).toBeNull()
    expect(
      parseSesFeedback(
        JSON.stringify({
          eventType: 'Bounce',
          bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'nobody' }] },
        }),
      ),
    ).toBeNull()
    const badTag = parseSesFeedback(
      JSON.stringify({
        eventType: 'Complaint',
        complaint: { complainedRecipients: [{ emailAddress: 'a@b.co' }] },
        mail: { tags: { 'store-id': ["x' or 1=1"] } },
      }),
    )
    expect(badTag?.storeTag).toBeNull()
  })
})

describe('handleSesSnsWebhook', () => {
  const deps = (extra: Partial<SesWebhookDeps> = {}): SesWebhookDeps => ({
    topicArn: F.topic,
    fetchCert: goodCerts().fetchCert,
    now: NOW,
    ...extra,
  })

  it('is off until the topic is configured', async () => {
    expect(
      await handleSesSnsWebhook(noDb, body(F.hardBounceV1), deps({ topicArn: undefined })),
    ).toEqual({
      status: 'rejected',
      reason: 'SES_EVENTS_TOPIC_ARN is not set',
    })
  })

  it('refuses another topic before fetching any certificate', async () => {
    const c = goodCerts()
    const r = await handleSesSnsWebhook(
      noDb,
      body(F.hardBounceV1),
      deps({
        topicArn: 'arn:aws:sns:ap-south-1:999999999999:someone-else',
        fetchCert: c.fetchCert,
      }),
    )
    expect(r).toEqual({ status: 'rejected', reason: 'unexpected topic' })
    expect(c.asked).toEqual([])
  })

  it('refuses a forged or changed message', async () => {
    const r = await handleSesSnsWebhook(
      noDb,
      body({ ...F.hardBounceV1, MessageId: 'sns-forged' }),
      deps(),
    )
    expect(r).toEqual({ status: 'rejected', reason: 'signature: signature' })
    expect(await handleSesSnsWebhook(noDb, 'hello', deps())).toMatchObject({ status: 'rejected' })
  })

  it('confirms a signed subscription by visiting its SNS link, and never another host', async () => {
    const visited: string[] = []
    const confirm = async (url: string) => {
      visited.push(url)
    }
    expect(await handleSesSnsWebhook(noDb, body(F.subscriptionV2), deps({ confirm }))).toEqual({
      status: 'confirmed',
    })
    expect(visited).toEqual([F.subscriptionV2.SubscribeURL])
    expect(
      await handleSesSnsWebhook(noDb, body(F.evilSubscriptionV2), deps({ confirm })),
    ).toMatchObject({ status: 'rejected' })
    expect(visited).toHaveLength(1)
  })

  it('ignores events that are not bounces or complaints, and mail with no store', async () => {
    expect(await handleSesSnsWebhook(noDb, body(F.deliveryV2), deps())).toEqual({
      status: 'ignored',
      reason: 'not a bounce or complaint',
    })
    const hints: unknown[] = []
    const findStore = async (hint: unknown) => {
      hints.push(hint)
      return null
    }
    expect(await handleSesSnsWebhook(noDb, body(F.complaintV2), deps({ findStore }))).toEqual({
      status: 'ignored',
      reason: 'no store for this message',
    })
    expect(hints).toEqual([{ storeTag: null, fromDomain: 'shop.example' }])
  })
})
