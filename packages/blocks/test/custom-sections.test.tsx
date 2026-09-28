import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { colourValue, elementStyle, safeColour, visibilityClassName } from '../src/element-style'
import { createBlocksConfig } from '../src/puck-config'
import { renderBlock, withServerSlots } from '../src/slots'

const config = createBlocksConfig(async () => [])
const components = config.components as unknown as Parameters<typeof renderBlock>[1]
const puck = { isEditing: false, metadata: {} }
const draw = (item: { type: string; props: Record<string, unknown> }) =>
  renderToStaticMarkup(<div>{renderBlock(item, components, puck)}</div>)

const heading = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
  type: 'Heading',
  props: { id, text, level: 'h3', ...extra },
})

describe('slots render on the server', () => {
  it('draws a Group with its children, in order, inside its flex container', () => {
    const html = draw({
      type: 'Group',
      props: {
        id: 'g1',
        direction: 'row',
        gap: 16,
        content: [heading('h1', 'First'), heading('h2', 'Second')],
      },
    })
    expect(html).toMatch(/<h3[^>]*>First<\/h3>.*<h3[^>]*>Second<\/h3>/)
    expect(html).toContain('flex-direction:row')
    expect(html).toContain('gap:1rem')
  })

  it('nests: a Group in Columns in a Group, three levels down', () => {
    const html = draw({
      type: 'Group',
      props: {
        id: 'outer',
        content: [
          {
            type: 'Columns',
            props: {
              id: 'cols',
              columns: [
                { content: [heading('left', 'Left')] },
                {
                  content: [
                    { type: 'Group', props: { id: 'inner', content: [heading('deep', 'Deep')] } },
                  ],
                },
              ],
            },
          },
        ],
      },
    })
    expect(html).toContain('Left')
    expect(html).toContain('Deep')
    expect(html.indexOf('Left')).toBeLessThan(html.indexOf('Deep'))
  })

  it('reordering the stored slot array reorders the output', () => {
    const a = heading('a', 'Alpha')
    const b = heading('b', 'Beta')
    const first = draw({ type: 'Group', props: { id: 'g', content: [a, b] } })
    const swapped = draw({ type: 'Group', props: { id: 'g', content: [b, a] } })
    expect(first.indexOf('Alpha')).toBeLessThan(first.indexOf('Beta'))
    expect(swapped.indexOf('Beta')).toBeLessThan(swapped.indexOf('Alpha'))
  })

  it('skips children hidden with the eye', () => {
    const html = draw({
      type: 'Group',
      props: { id: 'g', content: [heading('a', 'Shown'), heading('b', 'Gone', { _hidden: true })] },
    })
    expect(html).toContain('Shown')
    expect(html).not.toContain('Gone')
  })

  it('fills slots inside array items (tabs, accordion items, slides)', () => {
    const html = draw({
      type: 'Accordion',
      props: {
        id: 'acc',
        items: [
          { title: 'Shipping', open: true, content: [heading('s', 'Ships in 2 days')] },
          { title: 'Returns', open: false, content: [heading('r', 'Seven day returns')] },
        ],
      },
    })
    expect(html).toContain('<details')
    expect(html).toContain('Ships in 2 days')
    expect(html).toContain('Seven day returns')
  })

  it('renders every tab panel into the HTML, the first one visible', () => {
    const html = draw({
      type: 'Tabs',
      props: {
        id: 't',
        tabs: [
          { label: 'One', content: [heading('x', 'Panel one')] },
          { label: 'Two', content: [heading('y', 'Panel two')] },
        ],
      },
    })
    expect(html).toContain('role="tablist"')
    expect(html).toContain('Panel one')
    expect(html).toContain('Panel two')
    expect(html).toMatch(/role="tabpanel"[^>]*hidden=""/)
  })

  it('leaves unknown child types out instead of throwing', () => {
    expect(
      draw({ type: 'Group', props: { id: 'g', content: [{ type: 'Nope', props: { id: 'n' } }] } }),
    ).toContain('custom-group')
  })

  it('withServerSlots leaves non-slot props alone', () => {
    const props = withServerSlots(
      { text: 'x', content: [] },
      { text: { type: 'text' }, content: { type: 'slot' } },
      () => null,
    )
    expect(props.text).toBe('x')
    expect(typeof props.content).toBe('function')
  })
})

describe('Custom HTML renders sanitised', () => {
  it('drops scripts and handlers on the storefront render', () => {
    const html = draw({
      type: 'CustomHtml',
      props: { id: 'e', html: '<p onmouseover="steal()">Hi</p><script>steal()</script>' },
    })
    expect(html).toContain('<p>Hi</p>')
    expect(html).not.toContain('steal')
  })
})

describe('responsive visibility', () => {
  it('maps each hidden breakpoint to a CSS-only class', () => {
    expect(visibilityClassName({ mobile: false, tablet: true, desktop: true })).toBe(
      'max-md:hidden',
    )
    expect(visibilityClassName({ mobile: true, tablet: false, desktop: true })).toBe(
      'md:max-lg:hidden',
    )
    expect(visibilityClassName({ mobile: true, tablet: true, desktop: false })).toBe('lg:hidden')
    expect(visibilityClassName({ mobile: false, tablet: false, desktop: false })).toBe(
      'max-md:hidden md:max-lg:hidden lg:hidden',
    )
    expect(visibilityClassName(undefined)).toBe('')
  })

  it('puts the classes on the element in the server HTML', () => {
    const html = draw(
      heading('h', 'Desktop only', {
        style: { visibility: { mobile: false, tablet: false, desktop: true } },
      }),
    )
    const classes = /class="([^"]*)"/.exec(html)?.[1]?.split(' ') ?? []
    expect(classes).toContain('max-md:hidden')
    expect(classes).toContain('md:max-lg:hidden')
    expect(classes).not.toContain('lg:hidden')
  })
})

describe('element style', () => {
  it('turns spacing and size into rem inline styles', () => {
    const { style } = elementStyle({
      spacing: { marginTop: 16, marginBottom: 0, paddingX: 8, paddingY: 4 },
      size: { width: 'full', maxWidth: 640, minHeight: 0 },
    })
    expect(style).toMatchObject({
      marginTop: '1rem',
      paddingLeft: '0.5rem',
      paddingRight: '0.5rem',
      paddingTop: '0.25rem',
      width: '100%',
      maxWidth: '40rem',
    })
    expect(style.marginBottom).toBeUndefined()
  })

  it('prefers theme tokens and only accepts real custom colours', () => {
    expect(colourValue({ token: 'brand', custom: '' })).toBe('var(--color-brand)')
    expect(colourValue({ token: 'custom', custom: '#ff0088' })).toBe('#ff0088')
    expect(colourValue({ token: 'custom', custom: 'red;background:url(https://x)' })).toBeNull()
    expect(safeColour('url(https://evil.example/x)')).toBeNull()
    expect(colourValue({ token: 'inherit', custom: '' })).toBeNull()
  })

  it('ignores alignments, sizes and weights it does not know', () => {
    const { style } = elementStyle({
      typography: {
        align: 'left;position:fixed' as never,
        size: 'constructor' as never,
        weight: 'bold' as never,
      },
      corners: { radius: 'constructor' as never, shadow: '__proto__' as never },
      colour: { text: { token: 'constructor' as never, custom: '' } },
    })
    expect(style).toEqual({})
    expect(
      elementStyle({ typography: { weight: '1000' as never } }).style.fontWeight,
    ).toBeUndefined()
    expect(
      elementStyle({ typography: { align: 'center', weight: '600', size: 'lg' } }).style,
    ).toMatchObject({ textAlign: 'center', fontWeight: 600, fontSize: '1.125rem' })
  })
})

describe('column widths', () => {
  const columns = (n: number, desktop: string, tablet = 'same', mobile = 'stack') =>
    draw({
      type: 'Columns',
      props: {
        id: 'c',
        columns: Array.from({ length: n }, () => ({ content: [] })),
        layout: { desktop, tablet, mobile },
      },
    })

  it('reads a preset as fr ratios, stacking on phones', () => {
    const html = columns(2, '1:2')
    expect(html).toContain('--cols-d:minmax(0,1fr) minmax(0,2fr)')
    expect(html).toContain('--cols-t:minmax(0,1fr) minmax(0,2fr)')
    expect(html).toContain('--cols-m:minmax(0,1fr)')
  })

  it('falls back to equal widths when the preset does not fit the count', () => {
    expect(columns(3, '1:2')).toContain('--cols-d:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)')
  })

  it('goes two across on tablets when asked', () => {
    expect(columns(4, '1:1:1:1', 'two')).toContain('--cols-t:repeat(2,minmax(0,1fr))')
  })
})
