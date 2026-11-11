import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { sampleTemplateData } from '@commerce/notifications/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeSesClient } from '../src/client'
import { SesChannel } from '../src/ses'

const config = {
  region: 'ap-south-1',
  accessKeyId: 'AKIAOFFLINE',
  secretAccessKey: 'offline-secret',
  fromEmail: 'orders@example.com',
}

/** A local endpoint that takes the request and never answers: SES on a bad day. */
let server: Server
let endpoint = ''
beforeAll(async () => {
  server = createServer(() => {})
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
})

describe('SES client timeouts', () => {
  it('has a deadline on every call the channel makes by default', async () => {
    const channel = new SesChannel(config) as unknown as {
      client: { config: { requestHandler: { configProvider: Promise<Record<string, unknown>> } } }
    }
    const handler = await channel.client.config.requestHandler.configProvider
    expect(handler.requestTimeout).toBe(15_000)
    expect(handler.connectionTimeout).toBe(5_000)
  })

  it('fails a send that never gets an answer, as a retryable failure', async () => {
    const client = makeSesClient({
      ...config,
      endpoint,
      timeouts: { requestTimeout: 200 },
      maxAttempts: 1,
    })
    const started = Date.now()
    const r = await new SesChannel(config, client).send({
      to: { email: 'shopper@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r).toMatchObject({ ok: false, retryable: true })
    expect(Date.now() - started).toBeLessThan(5_000)
  }, 10_000)
})
