/** SOURCE OF TRUTH: "My sections" tests. WHAT save-as-section round trip (ids regenerated at every depth), limits, nested sanitising and stripResolved. WHY a pasted or inserted copy must never share ids with the page. No database. */
import { describe, expect, it } from 'vitest'
import {
  CUSTOM_SECTION_LIMITS,
  type CustomSection,
  CustomSectionProblem,
  instantiateCustomSection,
  parseCustomSections,
  prepareCustomSection,
  withCustomSection,
} from './custom-sections'
import { sanitizeTemplateEmbeds } from './embeds'
import { mapNestedBlocks } from './nested-blocks'
import { stripResolved } from './templates-data'

/** Every block id inside a value, depth first. */
function blockIds(value: unknown): string[] {
  const ids: string[] = []
  mapNestedBlocks(value, (b) => {
    ids.push(b.props.id as string)
    return b
  })
  return ids
}

/** A Group holding a Heading, an Image and Columns whose second column holds a Custom HTML. */
const group = () => ({
  type: 'Group',
  props: {
    id: 'Group-1',
    _name: 'Promo strip',
    content: [
      { type: 'Heading', props: { id: 'Heading-1', text: 'Hello', level: 'h2' } },
      {
        type: 'Image',
        props: { id: 'Image-1', image: { url: 'https://cdn.example/a.jpg', alt: 'A' } },
      },
      {
        type: 'Columns',
        props: {
          id: 'Columns-1',
          columns: [
            { content: [] },
            {
              content: [
                {
                  type: 'CustomHtml',
                  props: { id: 'CustomHtml-1', html: '<p onclick="x()">Hi</p><script>1</script>' },
                },
                {
                  type: 'ProductCard',
                  props: { id: 'ProductCard-1', productHandle: 'mouse', resolved: { id: 'p' } },
                },
              ],
            },
          ],
        },
      },
    ],
  },
})

describe('save as my section, then insert: a round trip', () => {
  it('prepares a copy: name trimmed, thumbnail found, editor data dropped, HTML sanitised', () => {
    const prepared = prepareCustomSection({ name: '  Promo strip  ', block: group() })
    expect(prepared.name).toBe('Promo strip')
    expect(prepared.thumbnail).toBe('https://cdn.example/a.jpg')
    const json = JSON.stringify(prepared.block)
    expect(json).not.toContain('resolved')
    expect(json).not.toContain('onclick')
    expect(json).not.toContain('<script')
    expect(json).toContain('<p>Hi</p>')
    // The merchant's own name for the group stays with it.
    expect(prepared.block.props._name).toBe('Promo strip')
  })

  it('inserts a copy with a fresh id on every block, at every depth', () => {
    const { block } = prepareCustomSection({ name: 'Promo', block: group() })
    const before = blockIds(block)
    let n = 0
    const copy = instantiateCustomSection(block, (type) => `${type}-new-${++n}`)
    const after = blockIds(copy)
    expect(after).toHaveLength(before.length)
    expect(before).toHaveLength(6)
    for (const id of after) expect(before).not.toContain(id)
    expect(new Set(after).size).toBe(after.length)
    // Same shape otherwise, and the saved original is untouched.
    expect(JSON.stringify(copy).replace(/"id":"[^"]+"/g, '')).toBe(
      JSON.stringify(block).replace(/"id":"[^"]+"/g, ''),
    )
    expect(blockIds(block)).toEqual(before)
  })

  it('two inserts of the same section never share ids', () => {
    const { block } = prepareCustomSection({ name: 'Promo', block: group() })
    const a = blockIds(instantiateCustomSection(block))
    const b = blockIds(instantiateCustomSection(block))
    expect(a.filter((id) => b.includes(id))).toEqual([])
  })

  it('refuses a blank name, a non-block and anything too big or too deep', () => {
    expect(() => prepareCustomSection({ name: ' ', block: group() })).toThrow(CustomSectionProblem)
    expect(() => prepareCustomSection({ name: 'x', block: { type: 'Group' } })).toThrow(
      CustomSectionProblem,
    )
    const big = group()
    big.props.content.push({
      type: 'Heading',
      props: { id: 'Heading-big', text: 'x'.repeat(CUSTOM_SECTION_LIMITS.bytes), level: 'h2' },
    })
    expect(() => prepareCustomSection({ name: 'Big', block: big })).toThrow(/too large/)
    let deep: { type: string; props: Record<string, unknown> } = {
      type: 'Heading',
      props: { id: 'h', text: 'x' },
    }
    for (let i = 0; i < CUSTOM_SECTION_LIMITS.depth + 1; i++) {
      deep = { type: 'Group', props: { id: `g${i}`, content: [deep] } }
    }
    expect(() => prepareCustomSection({ name: 'Deep', block: deep })).toThrow(/nested too deeply/)
  })

  it('caps how many sections a store keeps', () => {
    const one = (i: number): CustomSection => ({
      id: `s${i}`,
      name: `S${i}`,
      thumbnail: null,
      block: { type: 'Heading', props: { id: `h${i}` } },
      createdAt: '2026-09-27T00:00:00.000Z',
    })
    const full = Array.from({ length: CUSTOM_SECTION_LIMITS.count }, (_, i) => one(i))
    expect(() => withCustomSection(full, one(99))).toThrow(CustomSectionProblem)
    expect(withCustomSection(full.slice(1), one(99))[0]?.id).toBe('s99')
  })

  it('parses the stored list, dropping malformed entries', () => {
    expect(parseCustomSections(null)).toEqual([])
    expect(
      parseCustomSections([
        { id: 'a', name: 'A', block: { type: 'Group', props: { id: 'g' } } },
        { id: 'b', name: 'B', block: { type: 'Group' } },
        'nope',
      ]).map((s) => s.id),
    ).toEqual(['a'])
  })

  it('finds no thumbnail when the section has no usable image', () => {
    const block = {
      type: 'Image',
      props: { id: 'i', image: { url: 'javascript:alert(1)', alt: '' } },
    }
    expect(prepareCustomSection({ name: 'Pic', block }).thumbnail).toBeNull()
  })
})

describe('nested blocks in saved templates', () => {
  it('sanitises Custom HTML wherever it is nested', () => {
    const data = sanitizeTemplateEmbeds({ root: { props: {} }, content: [group()] as never })
    expect(JSON.stringify(data)).not.toContain('<script')
    expect(JSON.stringify(data)).not.toContain('onclick')
  })

  it('sanitises the typed-in fallback of a Custom HTML bound to a dynamic source', () => {
    const data = sanitizeTemplateEmbeds({
      root: { props: {} },
      content: [
        {
          type: 'CustomHtml',
          props: {
            id: 'e',
            html: {
              $source: 'product.metafields.custom.blurb',
              kind: 'text',
              fallback: '<p>Hi</p><script>alert(1)</script>',
            },
          },
        },
      ] as never,
    })
    expect(data.content[0]?.props.html).toEqual({
      $source: 'product.metafields.custom.blurb',
      kind: 'text',
      fallback: '<p>Hi</p>',
    })
  })

  it('strips resolveData output from nested blocks before comparing drafts', () => {
    const data = stripResolved({ root: { props: {} }, content: [group()] as never })
    expect(JSON.stringify(data)).not.toContain('resolved')
    expect(JSON.stringify(data)).toContain('"productHandle":"mouse"')
  })
})
