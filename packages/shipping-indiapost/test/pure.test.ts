import { describe, expect, it } from 'vitest'
import { normaliseArticleNumber, parseArticleNumber, s10CheckDigit } from '../src/article-number'
import { CONTRACTUAL_TARIFF, RETAIL_TARIFF } from '../src/data/speed-post-parcel-tariff'
import { freightRupees, parseTariffOverride, priceParcel } from '../src/tariff'
import { type PinPlace, zoneFor } from '../src/zones'

describe('article numbers (UPU S10)', () => {
  it('computes the check digit, including the 10 → 0 and 11 → 5 cases', () => {
    expect(s10CheckDigit('12345678')).toBe(5)
    // Sum 0 → 11 - 0 = 11 → 5.
    expect(s10CheckDigit('00000000')).toBe(5)
    // 8*1 = 8 → 11 - 8 = 3.
    expect(s10CheckDigit('10000000')).toBe(3)
    // 6*2 = 12 ≡ 1 (mod 11) → 11 - 1 = 10 → 0.
    expect(s10CheckDigit('02000000')).toBe(0)
  })

  it('accepts a valid domestic number and says what kind it is', () => {
    expect(parseArticleNumber('EE123456785IN')).toEqual({
      ok: true,
      number: 'EE123456785IN',
      kind: 'speed_post',
    })
    expect(parseArticleNumber(' ee 1234 5678 5 in ')).toMatchObject({
      ok: true,
      number: 'EE123456785IN',
    })
    expect(parseArticleNumber('RK000000005IN')).toMatchObject({ ok: true, kind: 'registered' })
    expect(parseArticleNumber('CP100000003IN')).toMatchObject({ ok: true, kind: 'parcel' })
  })

  it('rejects a wrong check digit, a foreign number and a wrong shape', () => {
    // The example number people quote, EE123456789IN, does not add up.
    expect(parseArticleNumber('EE123456789IN')).toEqual({ ok: false, reason: 'check_digit' })
    expect(parseArticleNumber('EE123456785US')).toEqual({ ok: false, reason: 'country' })
    expect(parseArticleNumber('EE12345678IN')).toEqual({ ok: false, reason: 'format' })
    expect(parseArticleNumber('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseArticleNumber(undefined)).toEqual({ ok: false, reason: 'empty' })
  })

  it('normalises what people paste from receipts', () => {
    expect(normaliseArticleNumber('ee-123.456/785 in')).toBe('EE123456785IN')
  })
})

describe('Speed Post Parcel tariff', () => {
  it('reads the published slabs', () => {
    expect(freightRupees(RETAIL_TARIFF, 'local', 500)).toBe(28)
    expect(freightRupees(RETAIL_TARIFF, 'otherStates', 501)).toBe(143)
    expect(freightRupees(CONTRACTUAL_TARIFF, 'metro', 1500)).toBe(110)
    expect(freightRupees(CONTRACTUAL_TARIFF, 'withinState', 5000)).toBe(156)
  })

  it('adds each further kilogram (or part) above 5 kg, and stops at 35 kg', () => {
    expect(freightRupees(RETAIL_TARIFF, 'otherStates', 5001)).toBe(686 + 120)
    expect(freightRupees(RETAIL_TARIFF, 'otherStates', 7000)).toBe(686 + 240)
    expect(freightRupees(RETAIL_TARIFF, 'local', 35_000)).toBe(174 + 30 * 35)
    expect(freightRupees(RETAIL_TARIFF, 'local', 35_001)).toBeNull()
  })

  it('adds registration and the COD fee, then 18 % GST on everything', () => {
    const p = priceParcel(RETAIL_TARIFF, 'local', 400, { registered: true, codFeePaise: 2000 })
    expect(p).toEqual({
      freightPaise: 2800,
      registrationPaise: 500,
      codFeePaise: 2000,
      gstPaise: Math.round((2800 + 500 + 2000) * 0.18),
      totalPaise: 2800 + 500 + 2000 + 954,
    })
  })

  it('takes a merchant rate card in the same shape and explains a bad one', () => {
    const card = {
      slabs: [
        { upToGrams: 1000, rupees: { local: 20, withinState: 30, metro: 35, otherStates: 40 } },
      ],
      additionalKgRupees: { local: 5, withinState: 6, metro: 7, otherStates: 8 },
    }
    const ok = parseTariffOverride(JSON.stringify(card))
    expect(ok).toEqual({ ok: true, card })
    if (ok.ok) expect(freightRupees(ok.card, 'metro', 2500)).toBe(35 + 2 * 7)
    expect(parseTariffOverride('{nope')).toMatchObject({ ok: false })
    expect(parseTariffOverride(JSON.stringify({ ...card, additionalKgRupees: {} }))).toMatchObject({
      ok: false,
    })
    expect(
      parseTariffOverride(JSON.stringify({ ...card, slabs: [card.slabs[0], card.slabs[0]] })),
    ).toEqual({ ok: false, error: 'weight slabs must go up in weight' })
  })
})

const at = (pincode: string, more: Partial<PinPlace> = {}): PinPlace => ({
  pincode,
  offices: [],
  district: null,
  state: null,
  source: 'prefix',
  ...more,
})

describe('zones', () => {
  it('local: same PIN, same metro city, or the same district', () => {
    expect(zoneFor(at('131028'), at('131028'))).toBe('local')
    expect(zoneFor(at('110001'), at('110092'))).toBe('local')
    const sonipat = { district: 'Sonipat', state: 'HR', source: 'directory' as const }
    expect(zoneFor(at('131028', sonipat), at('131001', sonipat))).toBe('local')
  })

  it('metro: two different metro cities', () => {
    expect(zoneFor(at('110001'), at('400001'))).toBe('metro')
    expect(zoneFor(at('560001'), at('700001'))).toBe('metro')
  })

  it('within state: the same state from one directory, or the same first two digits', () => {
    const hr = (district: string) => ({ district, state: 'HR', source: 'directory' as const })
    expect(zoneFor(at('131028', hr('Sonipat')), at('122001', hr('Gurugram')))).toBe('withinState')
    expect(zoneFor(at('131028'), at('132001'))).toBe('withinState')
  })

  it('special: the North East, Jammu & Kashmir, Ladakh and the islands', () => {
    expect(zoneFor(at('131028'), at('781001'))).toBe('special')
    expect(zoneFor(at('131028'), at('190001'))).toBe('special')
    expect(zoneFor(at('131028'), at('744101'))).toBe('special')
    expect(zoneFor(at('131028'), at('682555'))).toBe('special')
    const live = { source: 'data.gov.in' as const }
    expect(
      zoneFor(
        at('131028', { ...live, state: 'HARYANA' }),
        at('737101', { ...live, state: 'SIKKIM' }),
      ),
    ).toBe('special')
  })

  it('other states: everything else', () => {
    expect(zoneFor(at('131028'), at('560037'))).toBe('otherStates')
    expect(zoneFor(at('131028'), at('682001'))).toBe('otherStates')
  })

  it('does not compare a directory state with a guessed one', () => {
    const mixed = zoneFor(at('131028', { state: 'HR', source: 'directory' }), at('122001'))
    expect(mixed).toBe('otherStates')
  })
})
