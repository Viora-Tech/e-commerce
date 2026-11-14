import { describe, expect, it } from 'vitest'
import { revealConsentEarly } from './liquid-consent-reveal'

const BANNER =
  '<cookie-banner class="cookie-banner" data-storage-key="k" data-remember-days="180" hidden><div data-cookie-region tabindex="-1">Hi</div></cookie-banner>'

/** The inline script's body, as the browser would run it. */
function scriptOf(html: string): string {
  const m = html.match(/<script nonce="[^"]*">([\s\S]*?)<\/script>/)
  if (!m?.[1]) throw new Error('no script')
  return m[1]
}

type World = {
  ask?: boolean
  stamp?: string | null
  hash?: string
  designMode?: boolean
  shim?: boolean
  storageThrows?: boolean
}

/** Runs the script against a stand-in banner and returns what it did. */
function run(world: World) {
  const focused: unknown[] = []
  const region = { focus: (o: unknown) => focused.push(o) }
  const banner = {
    localName: 'cookie-banner',
    hidden: true,
    getAttribute: (name: string) =>
      ({ 'data-storage-key': 'k', 'data-remember-days': '180' })[name] ?? null,
    querySelector: () => region,
  }
  const window = {
    Shopify:
      world.shim === false
        ? undefined
        : {
            designMode: world.designMode ?? false,
            customerPrivacy: { shouldShowBanner: () => world.ask ?? true },
          },
  }
  const removed: string[] = []
  const localStorage = {
    getItem: (key: string) => {
      if (world.storageThrows) throw new Error('blocked')
      return key === 'k' ? (world.stamp ?? null) : null
    },
    removeItem: (key: string) => {
      if (world.storageThrows) throw new Error('blocked')
      removed.push(key)
    },
  }
  const document = { currentScript: { previousElementSibling: banner } }
  const location = { hash: world.hash ?? '' }
  new Function(
    'window',
    'document',
    'localStorage',
    'location',
    scriptOf(revealConsentEarly(BANNER, 'N')),
  )(window, document, localStorage, location)
  return { shown: !banner.hidden, focused: focused.length > 0, removed }
}

describe('revealConsentEarly', () => {
  it('puts a nonced script right after each theme cookie banner', () => {
    const out = revealConsentEarly(`<p>a</p>${BANNER}<p>b</p>`, 'nonceMARK')
    expect(out.startsWith(`<p>a</p>${BANNER}<script nonce="nonceMARK">`)).toBe(true)
    expect(out.endsWith('</script><p>b</p>')).toBe(true)
  })

  it('leaves other sections untouched', () => {
    const html = '<section><p>no banner here</p></section>'
    expect(revealConsentEarly(html, 'N')).toBe(html)
  })

  it('shows the banner, focused, when the shopper has not answered', () => {
    expect(run({})).toMatchObject({ shown: true, focused: true })
  })

  it('stays hidden when the consent cookie already holds an answer', () => {
    expect(run({ ask: false }).shown).toBe(false)
  })

  it("asks despite the theme's answered-recently stamp (set on Shopify, not our consent), and clears it", () => {
    expect(run({ stamp: String(Date.now() - 1000) })).toMatchObject({ shown: true, removed: ['k'] })
  })

  it('keeps the stamp when our cookie already holds an answer', () => {
    expect(run({ ask: false, stamp: String(Date.now() - 1000) })).toMatchObject({
      shown: false,
      removed: [],
    })
  })

  it('leaves the banner to the theme with no shim, in the editor, or for a Cookie settings link', () => {
    expect(run({ shim: false }).shown).toBe(false)
    expect(run({ designMode: true }).shown).toBe(false)
    expect(run({ hash: '#cookie-settings' }).shown).toBe(false)
  })

  it('still asks when local storage is blocked', () => {
    expect(run({ storageThrows: true }).shown).toBe(true)
  })
})
