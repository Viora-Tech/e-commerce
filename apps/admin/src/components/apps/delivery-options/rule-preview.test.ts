import { describe, expect, it } from 'vitest'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { draftOf, type RuleDraft } from './rule-draft'
import { rulePreview } from './rule-preview'

const mice = (patch: Partial<RuleDraft> = {}): RuleDraft => ({
  ...draftOf(null),
  name: 'Mice',
  values: ['c1'],
  carriers: ['delhivery', 'bluedart', 'amazon'],
  ...patch,
})

const line = (d: RuleDraft, names = new Map<string, string>()) =>
  rulePreview(d, deliveryOptionsContent, deliveryPagesContent, names)

describe('the rule dialog’s live line (#1781)', () => {
  it('names the preferred courier and the couriers shoppers can still pick', () => {
    expect(line(mice({ preferred: 'delhivery:express' }))?.text).toBe(
      'Mice ship by Delhivery Express / Air; shoppers can still pick Blue Dart or Amazon Shipping.',
    )
  })

  it('without a preferred courier, says which couriers may carry them', () => {
    expect(line(mice())?.text).toBe('Mice ship only with Delhivery, Blue Dart or Amazon Shipping.')
  })

  it('a single speed shows in each courier', () => {
    const d = mice({ carriers: ['delhivery'], express: false })
    expect(line(d)?.text).toBe('Mice ship only with Delhivery Surface.')
  })

  it('"always" says the store pays the difference', () => {
    const d = mice({ preferred: 'delhivery:express', forceRoute: true })
    expect(line(d)?.text).toBe(
      'Mice always ship by Delhivery Express / Air at the option’s price; you pay the difference.',
    )
  })

  it('adds insurance and the options it applies to, and says when the rule is off', () => {
    const d = mice({ insurance: 'required', optionIds: ['o1'], enabled: false })
    const out = line(d, new Map([['o1', 'Standard']]))
    expect(out?.text).toBe(
      'Mice ship only with Delhivery, Blue Dart or Amazon Shipping (always insured, in Standard).',
    )
    expect(out?.off).toBe(true)
  })

  it('falls back to the picked titles, and says nothing with no courier', () => {
    expect(line(mice({ name: '', titles: ['Glasspads'] }))?.text).toMatch(/^Glasspads ship only/)
    expect(line(mice({ carriers: [] }))).toBeNull()
  })
})
