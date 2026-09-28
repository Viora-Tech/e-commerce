/** SOURCE OF TRUTH: courier tracking numbers — tests one pattern per courier and the tracking links */
import { describe, expect, it } from 'vitest'
import {
  COURIERS,
  courierByName,
  detectCourier,
  normaliseTrackingNumber,
  s10CheckDigitValid,
  searchCouriers,
  trackingUrlFor,
} from './tracking-numbers'

describe('detectCourier', () => {
  it('picks India Post for an S10 number with a valid check digit', () => {
    expect(detectCourier('EE123456785IN')).toEqual({
      courier: 'india_post',
      candidates: ['india_post'],
    })
    // Registered Post, pasted lower case with spaces.
    expect(detectCourier('rn 123 456 785 in').courier).toBe('india_post')
  })

  it('rejects an S10-shaped number whose check digit is wrong', () => {
    expect(detectCourier('EE123456789IN')).toEqual({ courier: null, candidates: [] })
  })

  it('picks Ekart for FMPC and FMPP numbers', () => {
    expect(detectCourier('FMPC0123456789').courier).toBe('ekart')
    expect(detectCourier('FMPP1720702906').courier).toBe('ekart')
    // Some other four-letter prefix: not assumed to be Ekart.
    expect(detectCourier('ABCD0123456789').courier).toBeNull()
  })

  it('picks Shadowfax for SF numbers with a letter suffix', () => {
    expect(detectCourier('SF2964097734F').courier).toBe('shadowfax')
    expect(detectCourier('SF1234567890SIN').courier).toBe('shadowfax')
    expect(detectCourier('SF1234567890123CRD').courier).toBe('shadowfax')
  })

  it('picks DTDC for one letter and eight digits', () => {
    expect(detectCourier('D57291883').courier).toBe('dtdc')
    expect(detectCourier('z12345678').courier).toBe('dtdc')
  })

  it('offers Blue Dart first for 11 digits but does not pick, since Ecom Express shares it', () => {
    expect(detectCourier('77583124706')).toEqual({
      courier: null,
      candidates: ['bluedart', 'ecom_express'],
    })
  })

  it('does not pick for shared digit runs', () => {
    expect(detectCourier('123456789012')).toEqual({
      courier: null,
      candidates: ['amazon_shipping', 'delhivery', 'dtdc'],
    })
    expect(detectCourier('1234567890123').candidates).toEqual(['delhivery', 'ecom_express'])
    expect(detectCourier('13670617006682')).toEqual({
      courier: null,
      candidates: ['delhivery', 'xpressbees'],
    })
    expect(detectCourier('136706170066821').candidates).toEqual(['delhivery', 'xpressbees'])
  })

  it('only hints XpressBees for 16 digits, which is unconfirmed', () => {
    expect(detectCourier('1367061700668212')).toEqual({
      courier: null,
      candidates: ['xpressbees'],
    })
  })

  it('returns nothing for short, empty or unknown numbers', () => {
    expect(detectCourier('')).toEqual({ courier: null, candidates: [] })
    expect(detectCourier('1234')).toEqual({ courier: null, candidates: [] })
    expect(detectCourier('HELLO-WORLD-99')).toEqual({ courier: null, candidates: [] })
  })
})

describe('s10CheckDigitValid', () => {
  it('checks the mod 11 digit, including the 10 → 0 and 11 → 5 cases', () => {
    expect(s10CheckDigitValid('EE123456785IN')).toBe(true)
    // Serial 00000000: sum 0, 11 - 0 = 11 → 5.
    expect(s10CheckDigitValid('EE000000005IN')).toBe(true)
    // Serial 00000001: sum 7, 11 - 7 = 4.
    expect(s10CheckDigitValid('EE000000014IN')).toBe(true)
    // Serial 00000010: sum 9, 11 - 9 = 2.
    expect(s10CheckDigitValid('EE000000102IN')).toBe(true)
    // Serial 00000004: sum 28 → 28 mod 11 = 6, 11 - 6 = 5.
    expect(s10CheckDigitValid('EE000000045IN')).toBe(true)
    // Serial 00000100: sum 5, 11 - 5 = 6.
    expect(s10CheckDigitValid('EE000001006IN')).toBe(true)
    // Serial 00000006: sum 42 → 42 mod 11 = 9, 11 - 9 = 2.
    expect(s10CheckDigitValid('EE000000062IN')).toBe(true)
    // Serial 00000003: sum 21 → 21 mod 11 = 10, 11 - 10 = 1.
    expect(s10CheckDigitValid('EE000000031IN')).toBe(true)
    // Serial 00000008: sum 56 → 56 mod 11 = 1, 11 - 1 = 10 → 0.
    expect(s10CheckDigitValid('EE000000080IN')).toBe(true)
    expect(s10CheckDigitValid('EE000000081IN')).toBe(false)
    expect(s10CheckDigitValid('EEABCDEFGHIIN')).toBe(false)
  })
})

describe('trackingUrlFor', () => {
  it('puts the number in the link for couriers whose page takes it', () => {
    expect(trackingUrlFor('delhivery', ' 1234 5678 90123 ')).toBe(
      'https://www.delhivery.com/track/package/1234567890123',
    )
    expect(trackingUrlFor('bluedart', '77583124706')).toBe(
      'https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo=77583124706',
    )
  })

  it('opens the courier page without the number when it cannot take it', () => {
    expect(trackingUrlFor('dtdc', 'D57291883')).toBe('https://www.dtdc.com/track-your-shipment/')
  })

  it('has no link for Other, unknown couriers or an empty number', () => {
    expect(trackingUrlFor('other', 'ABC')).toBeNull()
    expect(trackingUrlFor('nope', 'ABC')).toBeNull()
    expect(trackingUrlFor('delhivery', '  ')).toBeNull()
  })
})

describe('courier list', () => {
  it('has unique ids and every courier the merchant asked for', () => {
    const ids = COURIERS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of [
      'delhivery',
      'delhivery_b2b',
      'shiprocket',
      'bluedart',
      'dtdc',
      'ecom_express',
      'xpressbees',
      'india_post',
      'ekart',
      'shadowfax',
      'amazon_shipping',
      'other',
    ]) {
      expect(ids).toContain(id)
    }
  })

  it('finds couriers by name or alias, ignoring case', () => {
    expect(courierByName('blue dart')?.id).toBe('bluedart')
    expect(courierByName('speed post')?.id).toBe('india_post')
    expect(courierByName('Nobody')).toBeNull()
    expect(searchCouriers('post').map((c) => c.id)).toContain('india_post')
    expect(searchCouriers('')).toHaveLength(COURIERS.length)
  })

  it('normalises pasted numbers', () => {
    expect(normaliseTrackingNumber(' fmpc-0123.456 789 ')).toBe('FMPC0123456789')
  })
})
