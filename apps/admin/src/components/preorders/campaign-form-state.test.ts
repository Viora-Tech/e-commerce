import { describe, expect, it } from 'vitest'
import {
  type CampaignFormState,
  emptyCampaign,
  takesPreorders,
  toCampaignInput,
  variantFallback,
} from './campaign-form-state'

const P1 = '00000000-0000-4000-8000-000000000001'
const P2 = '00000000-0000-4000-8000-000000000002'
const V1 = '00000000-0000-4000-8000-0000000000a1'
const V2 = '00000000-0000-4000-8000-0000000000a2'
const V3 = '00000000-0000-4000-8000-0000000000b1'

const form = (patch: Partial<CampaignFormState> = {}): CampaignFormState => ({
  ...emptyCampaign(),
  name: 'Launch',
  productIds: [P1],
  members: { [P1]: { variantIds: null, limit: '' } },
  ...patch,
})

describe('campaign variant limits in the form', () => {
  it('sends only the variant limits typed, blank as null', () => {
    const input = toCampaignInput(form({ variantLimits: { [P1]: { [V1]: '5', [V2]: ' ' } } }))
    expect(input?.variantLimits).toEqual([
      { variantId: V1, limit: 5 },
      { variantId: V2, limit: null },
    ])
  })

  it('sends none when nothing was typed', () => {
    expect(toCampaignInput(form())?.variantLimits).toEqual([])
  })

  it('refuses a variant limit that is not a whole number from 1 to 1,000,000', () => {
    for (const typed of ['0', '-2', '2.5', 'abc', '1000001']) {
      expect(toCampaignInput(form({ variantLimits: { [P1]: { [V1]: typed } } }))).toBeNull()
    }
    expect(toCampaignInput(form({ variantLimits: { [P1]: { [V1]: '1000000' } } }))).not.toBeNull()
  })

  it('leaves out variants of products no longer in the campaign and variants not picked', () => {
    const input = toCampaignInput(
      form({
        members: { [P1]: { variantIds: [V1], limit: '' } },
        variantLimits: { [P1]: { [V1]: '3', [V2]: '4' }, [P2]: { [V3]: '9' } },
      }),
    )
    expect(input?.variantLimits).toEqual([{ variantId: V1, limit: 3 }])
  })

  it('knows which variants take pre-orders', () => {
    const f = form({ members: { [P1]: { variantIds: [V1], limit: '' } } })
    expect(takesPreorders(f, P1, V1)).toBe(true)
    expect(takesPreorders(f, P1, V2)).toBe(false)
    expect(takesPreorders(form(), P1, V2)).toBe(true)
  })

  it('falls back to the product’s limit, then the campaign’s, then none', () => {
    expect(
      variantFallback(
        form({ limit: '20', members: { [P1]: { variantIds: null, limit: '7' } } }),
        P1,
      ),
    ).toEqual({ from: 'product', limit: 7 })
    expect(variantFallback(form({ limit: '20' }), P1)).toEqual({ from: 'campaign', limit: 20 })
    expect(variantFallback(form({ limit: 'x' }), P1)).toBeNull()
    expect(variantFallback(form(), P1)).toBeNull()
  })
})
