/** SOURCE OF TRUTH: tests for an imported theme's contact form (posted, errors, honeypot, Forms app missing) and the related products ranking and Search & Discovery picks */
import { describe, expect, it } from 'vitest'
import { createThemeEngine } from './engine'
import { DISCOVERY_NAMESPACE, pickedRecommendationIds, rankRelated } from './related'

function render(source: string, rt: { postedForm?: string | null; formsAvailable?: boolean }) {
  return createThemeEngine(new Map()).parseAndRenderSync(
    source,
    {},
    {
      globals: {
        _rt: {
          locale: {},
          currency: 'INR',
          moneyFormat: null,
          fonts: new Map(),
          nonce: '',
          shopifyHost: null,
          assetUrl: (f: string) => f,
          assetText: () => null,
          ...rt,
        },
      },
    },
  )
}

const CONTACT = `{% form 'contact' %}{% if form.posted_successfully? %}SENT{% endif %}{% if form.errors %}ERR {{ form.errors | default_errors }}{% endif %}<input name="contact[email]">{% endform %}`

describe("{% form 'contact' %}", () => {
  it('posts to our handler with a honeypot', () => {
    const html = render(CONTACT, {})
    expect(html).toContain('action="/theme-actions/contact"')
    expect(html).toContain('name="contact[email]"')
    expect(html).toContain('name="contact_website"')
    expect(html).not.toContain('SENT')
    expect(html).not.toContain('ERR')
  })

  it('reads as posted successfully after a good post', () => {
    expect(render(CONTACT, { postedForm: 'contact' })).toContain('SENT')
  })

  it('shows errors after a rejected post', () => {
    const html = render(CONTACT, { postedForm: 'contact_error' })
    expect(html).toContain('ERR')
    expect(html).toContain('class="errors"')
    expect(html).not.toContain('SENT')
  })

  it('shows a plain notice instead of the form when the Forms app is not installed', () => {
    const html = render(CONTACT, { formsAvailable: false })
    expect(html).toContain('form-unavailable')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('contact[email]')
  })

  it('leaves other forms alone when the Forms app is not installed', () => {
    const html = render("{% form 'customer' %}x{% endform %}", { formsAvailable: false })
    expect(html).toContain('<form')
  })
})

describe('rankRelated', () => {
  const c = (id: string, over: Partial<Parameters<typeof rankRelated>[1][number]> = {}) => ({
    id,
    type: '',
    tags: [],
    sharedCollections: 0,
    ...over,
  })

  it('puts shared collections before type and tags', () => {
    const out = rankRelated({ type: 'Serum', tags: ['dry'] }, [
      c('type', { type: 'serum' }),
      c('tag', { tags: ['DRY'] }),
      c('one', { sharedCollections: 1 }),
      c('two', { sharedCollections: 2 }),
    ])
    expect(out).toEqual(['two', 'one', 'type', 'tag'])
  })

  it('drops products that share nothing and keeps input order on ties', () => {
    const out = rankRelated({ type: '', tags: ['a'] }, [
      c('x'),
      c('first', { tags: ['a'] }),
      c('second', { tags: ['a'] }),
    ])
    expect(out).toEqual(['first', 'second'])
  })

  it('does not match an empty type', () => {
    expect(rankRelated({ type: '', tags: [] }, [c('a', { type: '' })])).toEqual([])
  })
})

describe('pickedRecommendationIds', () => {
  const field = (key: string, value: unknown) => ({
    namespace: DISCOVERY_NAMESPACE,
    key,
    type: 'product_reference' as const,
    list: true,
    measure: null,
    value,
  })
  const ref = (id: string) => ({ kind: 'product', id, handle: id })

  it("reads Search & Discovery's picks for each intent, in order, once each", () => {
    const fields = [
      field('related_products', [ref('b'), ref('a'), ref('b')]),
      field('complementary_products', [ref('c'), { kind: 'page', id: 'p' }]),
      { ...field('related_products', [ref('x')]), namespace: 'custom' },
    ]
    expect(DISCOVERY_NAMESPACE).toBe('shopify_discovery_product_recommendation')
    expect(pickedRecommendationIds(fields, 'related')).toEqual(['b', 'a'])
    expect(pickedRecommendationIds(fields, 'complementary')).toEqual(['c'])
    expect(pickedRecommendationIds([], 'related')).toEqual([])
  })
})
