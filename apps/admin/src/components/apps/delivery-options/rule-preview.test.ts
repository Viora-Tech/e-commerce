import { describe, expect, it } from 'vitest'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { draftOf, type RuleDraft } from './rule-draft'
import { rulePreview } from './rule-preview'

const mice = (patch: Partial<RuleDraft> = {}): RuleDraft => ({
  ...draftOf(null),
  name: 'Mice',
  values: ['c1'],
  chips: [
    'delhivery:standard',
    'delhivery:express',
    'bluedart:standard',
    'bluedart:express',
    'amazon:standard',
    'amazon:express',
  ],
  ...patch,
})

const money = (paise: number) => `₹${paise / 100}`
const line = (d: RuleDraft, names = new Map<string, string>()) =>
  rulePreview(
    d,
    deliveryOptionsContent,
    deliveryPagesContent,
    deliveryRuleFormContent,
    names,
    money,
  )

describe('the rule dialog’s live line (#1781, prices 20 Nov 2026)', () => {
  it('names the included courier and the couriers shoppers can still pick', () => {
    expect(line(mice({ preferred: 'delhivery:express' }))?.text).toBe(
      'Products in Mice ship by Delhivery Air; shoppers can still pick Blue Dart or Amazon Shipping.',
    )
  })

  it('states the price: free, or a fixed amount', () => {
    expect(line(mice({ preferred: 'delhivery:express', priceMode: 'free' }))?.text).toBe(
      'Products in Mice ship free by Delhivery Air; shoppers can still pick Blue Dart or Amazon Shipping.',
    )
    expect(line(mice({ priceMode: 'fixed', fixed: '99' }))?.text).toBe(
      'Products in Mice ship for ₹99 only with Delhivery, Blue Dart or Amazon Shipping.',
    )
  })

  it('adds free above to the extras', () => {
    const d = mice({ freeAboveOn: true, freeAbove: '999' })
    expect(line(d)?.text).toBe(
      'Products in Mice ship only with Delhivery, Blue Dart or Amazon Shipping (free from ₹999).',
    )
  })

  it('a blank rule names what is to be picked, never "0 collections" (owner, 22 Nov 2026)', () => {
    const d = mice({ name: '', values: [], chips: ['delhivery:standard'] })
    expect(line(d)?.text).toBe(
      'Products in the collections you pick ship only with Delhivery Surface.',
    )
  })

  it('a single speed shows in each courier', () => {
    const d = mice({ chips: ['delhivery:standard'] })
    expect(line(d)?.text).toBe('Products in Mice ship only with Delhivery Surface.')
  })

  it('"only this one" at the normal price says the store pays the difference', () => {
    const d = mice({ preferred: 'delhivery:express', forceRoute: true })
    expect(line(d)?.text).toBe(
      'Products in Mice always ship by Delhivery Air at the option’s price; you pay the difference.',
    )
  })

  it('adds insurance and the options it applies to, and says when the rule is off', () => {
    const d = mice({ insurance: 'required', optionIds: ['o1'], enabled: false })
    const out = line(d, new Map([['o1', 'Standard']]))
    expect(out?.text).toBe(
      'Products in Mice ship only with Delhivery, Blue Dart or Amazon Shipping (always insured, in Standard).',
    )
    expect(out?.off).toBe(true)
  })

  it('falls back to the picked titles, and says nothing with no courier', () => {
    expect(line(mice({ name: '', titles: ['Glasspads'] }))?.text).toMatch(
      /^Products in Glasspads ship only/,
    )
    expect(line(mice({ chips: [] }))).toBeNull()
  })
})
