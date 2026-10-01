import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { discordCtaSection } from '../src/sections/glide/discord-cta'
import { dropRevealSection } from '../src/sections/glide/drop-reveal'
import { socialWallSection } from '../src/sections/glide/social-wall'
import type { CardProduct } from '../src/types'

const product = (n: number): CardProduct => ({
  id: `p${n}`,
  handle: `p-${n}`,
  title: `Product ${n}`,
  vendor: null,
  productType: null,
  pricePaise: 100000,
  mrpPaise: null,
  available: 5,
  images: [{ url: `/media/p${n}.jpg`, alt: null }],
})

const loaders = { loadProducts: async () => [] }

function html(config: ReturnType<typeof discordCtaSection>, extra: Record<string, unknown> = {}) {
  const props = { ...(config.defaultProps as Record<string, unknown>), ...extra }
  // @ts-expect-error -- loose test props against the widened component type
  return renderToStaticMarkup(config.render({ ...props, puck: { metadata: {} } }))
}

describe('discord cta', () => {
  it('renders perks, button and no empty src', () => {
    const out = html(discordCtaSection(loaders), { buttonUrl: 'https://discord.gg/x' })
    expect(out).toContain('Early drops')
    expect(out).toContain('href="https://discord.gg/x"')
    expect(out).not.toContain('src=""')
  })
})

describe('social wall', () => {
  it('shows tabs only when posts span platforms, and hides non-matching tiles on filter', () => {
    const config = socialWallSection(loaders)
    expect(html(config)).not.toContain('role="tablist"')
    const posts = [
      { platform: 'instagram', image: { url: '', alt: '' }, videoId: '', link: '', caption: 'a' },
      { platform: 'youtube', image: { url: '', alt: '' }, videoId: 'abc', link: '', caption: 'b' },
    ]
    const out = html(config, { posts })
    expect(out).toContain('role="tablist"')
    expect(out).toContain('i.ytimg.com/vi/abc')
    expect(out).not.toContain('src=""')
  })
  it('duplicates tiles for the marquee and hides the copy from assistive tech', () => {
    const out = html(socialWallSection(loaders), { layout: 'carousel', autoscroll: true })
    expect(out.match(/social-tile /g)?.length).toBe(10)
    expect(out).toContain('aria-hidden="true"')
  })
})

describe('drop reveal', () => {
  it('renders one item per product with the timeline variables', () => {
    const config = dropRevealSection(loaders)
    const out = html(config, { resolved: [1, 2, 3, 4].map(product) })
    expect(out.match(/data-drop-item/g)?.length).toBe(4)
    expect(out).toContain('--fan:-1.5')
    expect(out).toContain('href="/collections/preorder"')
    expect(out).not.toContain('src=""')
  })
  it('shows the empty message with no products', () => {
    expect(html(dropRevealSection(loaders))).toContain('Pick a collection')
  })
})
