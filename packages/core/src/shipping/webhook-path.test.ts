/** SOURCE OF TRUTH: courier webhook path tests — WHAT: Shiprocket gets the neutral alias, others the named path, codes map back safely / WHY: a pasted webhook URL must keep reaching the same handler */
import { describe, expect, it } from 'vitest'
import {
  COURIER_WEBHOOK_CODES,
  courierForWebhookCode,
  courierWebhookPath,
  webhookCodeFor,
} from './webhook-path'

const STORE = '7d3c1c52-0b9e-4a52-9a43-2d3c64a1f0aa'

describe('courier webhook paths', () => {
  it('gives Shiprocket a path without its name in it', () => {
    const path = courierWebhookPath('shiprocket', STORE)
    expect(path).toBe(`/webhooks/shipments/c/sr/${STORE}`)
    expect(path.toLowerCase()).not.toContain('shiprocket')
  })

  it('keeps the provider-named path for the other couriers', () => {
    expect(courierWebhookPath('delhivery', STORE)).toBe(`/webhooks/shipments/delhivery/${STORE}`)
    expect(courierWebhookPath('unknown-courier', STORE)).toBe(
      `/webhooks/shipments/unknown-courier/${STORE}`,
    )
  })

  it('maps codes back to providers, and nothing else', () => {
    expect(courierForWebhookCode('sr')).toBe('shiprocket')
    expect(courierForWebhookCode('zz')).toBeNull()
    expect(courierForWebhookCode('toString')).toBeNull()
    expect(courierForWebhookCode('__proto__')).toBeNull()
    expect(webhookCodeFor('shiprocket')).toBe('sr')
    expect(webhookCodeFor('nobody')).toBeNull()
  })

  it('has one short code per courier', () => {
    const ids = Object.values(COURIER_WEBHOOK_CODES)
    expect(new Set(ids).size).toBe(ids.length)
    for (const code of Object.keys(COURIER_WEBHOOK_CODES)) expect(code).toMatch(/^[a-z0-9]{1,4}$/)
  })
})
