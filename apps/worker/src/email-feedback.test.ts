import { createMemoryRateLimitStore } from '@commerce/core'
import type { Db } from '@commerce/db'
import { describe, expect, it, vi } from 'vitest'
import { emailFeedbackWebhooks } from './email-feedback'
import { WEBHOOK_REJECTED_BODY, WEBHOOK_REJECTED_STATUS } from './webhook-reply'

/** Any database use fails the test: refusals happen before a store is known. */
const noDb = new Proxy(
  {},
  {
    get() {
      throw new Error('the database must not be used')
    },
  },
) as Db

const TOPIC = 'arn:aws:sns:ap-south-1:123456789012:ses-events'

async function post(app: ReturnType<typeof emailFeedbackWebhooks>, body: string) {
  const res = await app.request('/webhooks/email/ses', { method: 'POST', body })
  return { status: res.status, body: await res.text() }
}

describe('POST /webhooks/email/ses', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const rejected = { status: WEBHOOK_REJECTED_STATUS, body: JSON.stringify(WEBHOOK_REJECTED_BODY) }

  it('refuses everything while SES_EVENTS_TOPIC_ARN is unset', async () => {
    const app = emailFeedbackWebhooks(noDb, { topicArn: undefined }, createMemoryRateLimitStore())
    expect(await post(app, '{}')).toEqual(rejected)
  })

  it('answers junk, another topic and a bad signature with the same generic rejection', async () => {
    const fetchCert = vi.fn(async () => 'not a pem')
    const app = emailFeedbackWebhooks(
      noDb,
      { topicArn: TOPIC, fetchCert },
      createMemoryRateLimitStore(),
    )
    const envelope = {
      Type: 'Notification',
      MessageId: 'm-1',
      TopicArn: TOPIC,
      Message: '{}',
      Timestamp: '2026-11-12T00:00:00Z',
      SignatureVersion: '2',
      Signature: 'AAAA',
      SigningCertURL: 'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-x.pem',
    }
    expect(await post(app, 'hello')).toEqual(rejected)
    expect(await post(app, JSON.stringify({ ...envelope, TopicArn: `${TOPIC}-other` }))).toEqual(
      rejected,
    )
    expect(await post(app, JSON.stringify(envelope))).toEqual(rejected)
    expect(fetchCert).toHaveBeenCalledTimes(1)
  })

  it('refuses a body over 256 KB before reading it as SNS', async () => {
    const app = emailFeedbackWebhooks(noDb, { topicArn: TOPIC }, createMemoryRateLimitStore())
    expect(await post(app, 'x'.repeat(300 * 1024))).toEqual(rejected)
  })
})
