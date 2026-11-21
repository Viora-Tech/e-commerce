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
  /** The theme's script has defined `<cookie-banner>`. */
  defined?: boolean
}

/** Runs the script against a stand-in banner and returns what it did. */
function run(world: World) {
  const focused: unknown[] = []
  const region = { focus: (o: unknown) => focused.push(o) }
  const panel = { hidden: true }
  const marketing = { checked: false }
  const analytics = { checked: true }
  const parts: Record<string, unknown> = {
    '[data-cookie-region]': region,
    '[data-cookie-panel]': panel,
    '[data-cookie-analytics]': analytics,
    '[data-cookie-marketing]': marketing,
  }
  let onClick: ((e: unknown) => void) | null = null
  const banner = {
    localName: 'cookie-banner',
    hidden: true,
    getAttribute: (name: string) =>
      ({ 'data-storage-key': 'k', 'data-remember-days': '180' })[name] ?? null,
    querySelector: (q: string) => parts[q] ?? null,
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      if (type === 'click') onClick = fn
    },
  }
  const answers: unknown[] = []
  const window = {
    Shopify:
      world.shim === false
        ? undefined
        : {
            designMode: world.designMode ?? false,
            customerPrivacy: {
              shouldShowBanner: () => world.ask ?? true,
              setTrackingConsent: (c: unknown) => answers.push(c),
            },
          },
    customElements: { get: () => (world.defined ? class {} : undefined) },
  }
  const removed: string[] = []
  const stamps: string[] = []
  const localStorage = {
    setItem: (key: string) => {
      if (world.storageThrows) throw new Error('blocked')
      stamps.push(key)
    },
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
  const attrs: Record<string, string> = {}
  /** A tap on the element matching `selector` (the button or a span inside it). */
  const tap = (selector: string) => {
    const button = { setAttribute: (n: string, v: string) => (attrs[n] = v) }
    onClick?.({ target: { closest: (q: string) => (q === selector ? button : null) } })
  }
  return {
    shown: () => !banner.hidden,
    get focused() {
      return focused.length > 0
    },
    removed,
    stamps,
    answers,
    panel,
    attrs,
    analytics,
    tap,
  }
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
    const r = run({})
    expect(r.shown()).toBe(true)
    expect(r.focused).toBe(true)
  })

  it('stays hidden when the consent cookie already holds an answer', () => {
    expect(run({ ask: false }).shown()).toBe(false)
  })

  it("asks despite the theme's answered-recently stamp (set on Shopify, not our consent), and clears it", () => {
    const r = run({ stamp: String(Date.now() - 1000) })
    expect(r.shown()).toBe(true)
    expect(r.removed).toEqual(['k'])
  })

  it('keeps the stamp when our cookie already holds an answer', () => {
    const r = run({ ask: false, stamp: String(Date.now() - 1000) })
    expect(r.shown()).toBe(false)
    expect(r.removed).toEqual([])
  })

  it('leaves the banner to the theme with no shim, in the editor, or for a Cookie settings link', () => {
    expect(run({ shim: false }).shown()).toBe(false)
    expect(run({ designMode: true }).shown()).toBe(false)
    expect(run({ hash: '#cookie-settings' }).shown()).toBe(false)
  })

  it('still asks when local storage is blocked', () => {
    expect(run({ storageThrows: true }).shown()).toBe(true)
  })
})

describe('the revealed banner answers before the theme script binds it', () => {
  it('Accept all records a yes, stamps and hides the banner', () => {
    const r = run({})
    r.tap('[data-cookie-accept]')
    expect(r.answers).toEqual([
      { analytics: true, marketing: true, preferences: true, sale_of_data: true },
    ])
    expect(r.stamps).toEqual(['k'])
    expect(r.shown()).toBe(false)
  })

  it('Decline records a no', () => {
    const r = run({})
    r.tap('[data-cookie-decline]')
    expect(r.answers).toEqual([
      { analytics: false, marketing: false, preferences: false, sale_of_data: false },
    ])
  })

  it('Choose cookies opens the panel and Save records the ticked boxes', () => {
    const r = run({})
    r.tap('[data-cookie-preferences]')
    expect(r.panel.hidden).toBe(false)
    expect(r.attrs['aria-expanded']).toBe('true')
    expect(r.answers).toEqual([])
    r.tap('[data-cookie-save]')
    expect(r.answers).toEqual([
      { analytics: true, marketing: false, preferences: true, sale_of_data: false },
    ])
  })

  it('still answers when local storage is blocked', () => {
    const r = run({ storageThrows: true })
    r.tap('[data-cookie-accept]')
    expect(r.answers).toHaveLength(1)
    expect(r.shown()).toBe(false)
  })

  it("steps aside once the theme has defined <cookie-banner> (its own handler answers)", () => {
    const r = run({ defined: true })
    r.tap('[data-cookie-accept]')
    expect(r.answers).toEqual([])
    expect(r.shown()).toBe(true)
  })

  it('ignores taps elsewhere on the card', () => {
    const r = run({})
    r.tap('[data-something-else]')
    expect(r.answers).toEqual([])
    expect(r.shown()).toBe(true)
  })
})
