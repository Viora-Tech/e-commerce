/** SOURCE OF TRUTH: Inbox knowledge base rule tests — WHAT: which answers the AI reads for a question, how an imported Shopify "Knowledge Base Facts" entry becomes an answer (suggestions stay unpublished), which messages go straight to staff as refunds or cancellations, and that Take over silences the AI / WHY: these decide what the AI may tell shoppers in the store's name. */
import { describe, expect, it } from 'vitest'
import { aiMayAnswer } from './ai-rules'
import {
  asksForRefundOrCancel,
  factFromMetaobject,
  isKnowledgeFactsDefinition,
  pickKnowledge,
  questionWords,
} from './knowledge-rules'

const entry = (title: string, answer: string) => ({ title, answer })

describe('questionWords', () => {
  it('keeps words of three letters or more, once each', () => {
    expect(questionWords('Do you ship to Pune? Ship fast!')).toEqual([
      'you',
      'ship',
      'pune',
      'fast',
    ])
  })
})

describe('pickKnowledge', () => {
  const kb = [
    entry('Warranty', 'One year replacement warranty on every keyboard.'),
    entry('COD', 'Cash on delivery up to ₹5,000.'),
    entry('Shipping time', 'Orders ship in 1 to 2 days and arrive in 3 to 5.'),
  ]

  it('puts the best match first and keeps the rest in store order', () => {
    expect(pickKnowledge(kb, 'how long does shipping take?').map((e) => e.title)).toEqual([
      'Shipping time',
      'Warranty',
      'COD',
    ])
  })

  it('stops at the entry and character limits', () => {
    expect(pickKnowledge(kb, 'warranty', 1).map((e) => e.title)).toEqual(['Warranty'])
    const long = [entry('A', 'x'.repeat(50)), entry('B', 'y'.repeat(50)), entry('C', 'z')]
    expect(pickKnowledge(long, 'hello', 10, 60).map((e) => e.title)).toEqual(['A', 'C'])
  })
})

describe('isKnowledgeFactsDefinition', () => {
  it('finds Shopify’s knowledge base type by handle or name', () => {
    expect(isKnowledgeFactsDefinition({ type: 'shopify_knowledge_base_fact', name: 'x' })).toBe(
      true,
    )
    expect(isKnowledgeFactsDefinition({ type: 'faq', name: 'Knowledge Base Facts' })).toBe(true)
    expect(isKnowledgeFactsDefinition({ type: 'roadmap_entry', name: 'Roadmap entry' })).toBe(false)
  })
})

describe('factFromMetaobject', () => {
  it('copies a confirmed answer with its published flag', () => {
    expect(
      factFromMetaobject({
        title: 'Shipping time',
        value_string: 'We ship in 2 days.',
        published: true,
      }),
    ).toEqual({ title: 'Shipping time', answer: 'We ship in 2 days.', published: true })
  })

  it('writes lists, yes/no and numbers as words', () => {
    expect(
      factFromMetaobject({ title: 'Couriers', value_string_list: ['Delhivery', 'Xpressbees'] })
        ?.answer,
    ).toBe('Delhivery, Xpressbees')
    expect(factFromMetaobject({ title: 'COD?', value_boolean: true })?.answer).toBe('Yes')
    expect(factFromMetaobject({ title: 'Return days', value_number: 7 })?.answer).toBe('7')
  })

  it('keeps Shopify’s own suggestions unpublished, and drafts unpublished', () => {
    expect(
      factFromMetaobject({ title: 'Gift wrap', suggested_value_string: 'Yes', published: true }),
    ).toEqual({ title: 'Gift wrap', answer: 'Yes', published: false })
    expect(
      factFromMetaobject({ title: 'X', value_string: 'Y', published: 'true' }, 'draft')?.published,
    ).toBe(false)
  })

  it('names an untitled entry after its category, and skips one with no answer', () => {
    expect(
      factFromMetaobject({ category: 'shipping_info', value_string: 'Free over ₹999' })?.title,
    ).toBe('Shipping')
    expect(factFromMetaobject({ title: 'Empty' })).toBeNull()
  })
})

describe('asksForRefundOrCancel', () => {
  it('catches requests in English, Hinglish and Hindi', () => {
    expect(asksForRefundOrCancel('Please cancel my order')).toBe(true)
    expect(asksForRefundOrCancel('I want a refund')).toBe(true)
    expect(asksForRefundOrCancel('how do I return this item')).toBe(true)
    expect(asksForRefundOrCancel('order cancel kar do')).toBe(true)
    expect(asksForRefundOrCancel('mere paise wapas karo')).toBe(true)
    expect(asksForRefundOrCancel('मुझे रिफ़ंड चाहिए')).toBe(true)
    expect(asksForRefundOrCancel('ऑर्डर कैंसिल करना है')).toBe(true)
  })

  it('leaves policy questions for the AI to answer', () => {
    expect(asksForRefundOrCancel('What is your return policy?')).toBe(false)
    expect(asksForRefundOrCancel('Is the blue keyboard in stock?')).toBe(false)
    expect(asksForRefundOrCancel('do you have cash on delivery')).toBe(false)
  })
})

describe('aiMayAnswer', () => {
  const facts = {
    mode: 'all' as const,
    staffAvailable: true,
    status: 'open' as const,
    needsHuman: false,
    staffReplied: false,
  }

  it('answers until staff take over', () => {
    expect(aiMayAnswer(facts)).toBe(true)
    expect(aiMayAnswer({ ...facts, aiPaused: true })).toBe(false)
  })
})
