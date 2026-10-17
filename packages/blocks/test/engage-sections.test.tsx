import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import OffersStrip from '../src/components/sections/offers-strip'
import StoreLocator from '../src/components/sections/store-locator'
import { createBlocksConfig, SECTION_CATEGORIES } from '../src/puck-config'
import type { EngageProps } from '../src/sections/engage'

const KEYS: (keyof EngageProps)[] = ['SaleCountdown', 'OffersStrip', 'StoreLocator']
const minimalPuck = { metadata: {} }

describe('engage sections (Figma NEW: sale countdown, offers, store locator)', () => {
  const config = createBlocksConfig(async () => [])

  it('are registered and in a category', () => {
    const all = Object.values(SECTION_CATEGORIES).flatMap((c) => c.components)
    for (const key of KEYS) {
      expect(config.components[key], key).toBeTruthy()
      expect(all, key).toContain(key)
    }
  })

  for (const key of KEYS) {
    it(`${key} renders its defaults`, () => {
      const component = config.components[key]
      if (!component) throw new Error(`${key} is not registered`)
      const html = renderToStaticMarkup(
        // @ts-expect-error -- loose test props against the config's widened component type
        component.render({ ...(component.defaultProps as object), puck: minimalPuck }),
      )
      expect(html.length).toBeGreaterThan(0)
      expect(html).not.toContain('src=""')
    })
  }

  it('drops an offer link that is not safe', () => {
    const html = renderToStaticMarkup(
      <OffersStrip
        heading="Offers"
        offers={[
          {
            icon: 'payment',
            title: 'EMI',
            text: 'Pay later',
            link: { label: 'Details', href: 'javascript:alert(1)' },
          },
        ]}
      />,
    )
    expect(html).toContain('EMI')
    expect(html).not.toContain('javascript:')
  })

  it('links directions to the address and keeps the map off until asked', () => {
    const html = renderToStaticMarkup(
      <StoreLocator
        heading="Visit us"
        stores={[{ name: 'Store', address: 'Cyber Hub, Gurugram', hours: 'Open' }]}
      />,
    )
    expect(html).toContain('destination=Cyber%20Hub%2C%20Gurugram')
    expect(html).not.toContain('<iframe')
  })
})
