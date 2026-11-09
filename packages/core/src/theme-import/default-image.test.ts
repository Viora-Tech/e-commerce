/** SOURCE OF TRUTH: `| default:` keeps a Liquid object whole — an image picked by `a | default: b` still carries its sized copies, so `image_url: width:` picks a small copy instead of the multi-MB original */
import { Liquid } from 'liquidjs'
import { describe, expect, it } from 'vitest'
import { ImageDrop } from './drops'
import { registerShopifyFilters } from './filters'

const copy = (w: number) => ({ avif: `w${w}.avif`, webp: `w${w}.webp` })
const image = () =>
  new ImageDrop({
    url: 'master.png',
    width: 2560,
    height: 1800,
    variants: { '320': copy(320), '640': copy(640), '1280': copy(1280), '1920': copy(1920) },
  })

describe('default on an image', () => {
  const engine = new Liquid()
  registerShopifyFilters(engine)
  it('keeps the image, so image_url still picks a sized copy', async () => {
    const html = await engine.parseAndRender(
      '{%- assign img = picked | default: fallback -%}{{ img | image_url: width: 900 }}',
      { picked: image(), fallback: null },
    )
    expect(html).toBe('w1280.webp')
  })
  it('still falls back when the first value is blank', async () => {
    const html = await engine.parseAndRender(
      '{%- assign img = picked | default: fallback -%}{{ img | image_url: width: 300 }}',
      { picked: null, fallback: image() },
    )
    expect(html).toBe('w320.webp')
  })
  it('keeps text defaults working as before', async () => {
    expect(
      await engine.parseAndRender(
        "{{ '' | default: 'x' }}|{{ 'a' | default: 'x' }}|{{ false | default: 'x', allow_false: true }}",
        {},
      ),
    ).toBe('x|a|false')
  })
})
