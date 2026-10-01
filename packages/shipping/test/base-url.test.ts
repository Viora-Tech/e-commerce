import { describe, expect, it } from 'vitest'
import { courierBaseUrlProblem } from '../src/base-url'

describe('courierBaseUrlProblem', () => {
  const domains = ['delhivery.com']

  it('accepts the courier hosts and an empty override', () => {
    expect(courierBaseUrlProblem(undefined, domains)).toBeNull()
    expect(courierBaseUrlProblem('  ', domains)).toBeNull()
    expect(courierBaseUrlProblem('https://track.delhivery.com', domains)).toBeNull()
    expect(courierBaseUrlProblem('https://staging-express.delhivery.com/', domains)).toBeNull()
  })

  it('refuses any other host, so the stored token never leaves for it', () => {
    for (const url of [
      'https://attacker.example',
      'https://delhivery.com.attacker.example',
      'https://attackerdelhivery.com',
      'https://10.0.0.5',
      'https://track.delhivery.com@attacker.example',
      'https://track.delhivery.com:8443',
      'http://track.delhivery.com',
      'not a url',
    ]) {
      expect(courierBaseUrlProblem(url, domains), url).not.toBeNull()
    }
  })
})
