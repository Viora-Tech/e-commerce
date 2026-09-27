import { beforeEach, describe, expect, it, vi } from 'vitest'

type Mod = typeof import('../src/app-blocks/razorpay-affordability')

/** Razorpay's documented script URL (native web integration). */
const SCRIPT_SRC = 'https://cdn.razorpay.com/widgets/affordability/affordability.js'

// The module keeps one shared load and one widget slot per page; a fresh copy per test.
let claimAffordabilitySlot: Mod['claimAffordabilitySlot']
let isDarkTheme: Mod['isDarkTheme']
let loadAffordabilityScript: Mod['loadAffordabilityScript']
let releaseAffordabilitySlot: Mod['releaseAffordabilitySlot']
let renderAffordability: Mod['renderAffordability']

beforeEach(async () => {
  vi.resetModules()
  ;({
    claimAffordabilitySlot,
    isDarkTheme,
    loadAffordabilityScript,
    releaseAffordabilitySlot,
    renderAffordability,
  } = await import('../src/app-blocks/razorpay-affordability'))
})

/** A stand-in <script> element: records listeners so a test can fire load or error. Never fetches. */
function fakeScript() {
  const listeners: Record<string, (() => void)[]> = {}
  return {
    src: '',
    async: false,
    addEventListener(type: string, fn: () => void) {
      listeners[type] = [...(listeners[type] ?? []), fn]
    },
    fire(type: 'load' | 'error') {
      for (const fn of listeners[type] ?? []) fn()
    },
  }
}

function fakeDocument(existing: ReturnType<typeof fakeScript> | null = null) {
  const created: ReturnType<typeof fakeScript>[] = []
  const appended: unknown[] = []
  const doc = {
    querySelector: vi.fn(() => existing as unknown as Element | null),
    createElement: vi.fn(() => {
      const s = fakeScript()
      created.push(s)
      return s as unknown as HTMLScriptElement
    }),
    head: { appendChild: (n: unknown) => appended.push(n) },
  }
  return { doc, created, appended }
}

describe('loadAffordabilityScript', () => {
  it("adds Razorpay's hosted script once and shares the load", async () => {
    const { doc, created, appended } = fakeDocument()
    const a = loadAffordabilityScript(doc, {})
    const b = loadAffordabilityScript(doc, {})
    expect(a).toBe(b)
    expect(created).toHaveLength(1)
    expect(appended).toHaveLength(1)
    expect(created[0]?.src).toBe(SCRIPT_SRC)
    expect(created[0]?.async).toBe(true)
    created[0]?.fire('load')
    await expect(a).resolves.toBeUndefined()
  })

  it('reuses a script tag already on the page', async () => {
    const existing = fakeScript()
    const { doc, created, appended } = fakeDocument(existing)
    const p = loadAffordabilityScript(doc, {})
    expect(created).toHaveLength(0)
    expect(appended).toHaveLength(0)
    existing.fire('load')
    await expect(p).resolves.toBeUndefined()
  })

  it('resolves at once when the widget is already loaded', async () => {
    const { doc, created } = fakeDocument()
    await loadAffordabilityScript(doc, { RazorpayAffordabilitySuite: class {} as never })
    expect(created).toHaveLength(0)
  })

  it('rejects on a failed load and lets the next caller retry', async () => {
    const { doc, created } = fakeDocument()
    const first = loadAffordabilityScript(doc, {})
    created[0]?.fire('error')
    await expect(first).rejects.toThrow('failed to load')
    const second = loadAffordabilityScript(doc, {})
    expect(second).not.toBe(first)
    expect(created).toHaveLength(2)
  })
})

describe('renderAffordability', () => {
  it('passes the key id and amount in paise, then renders', () => {
    const render = vi.fn()
    const Suite = vi.fn(function (this: { render: () => void }) {
      this.render = render
    })
    const ok = renderAffordability(
      { RazorpayAffordabilitySuite: Suite as never },
      { key: 'rzp_test_abc', amount: 1_200_000 },
    )
    expect(ok).toBe(true)
    expect(Suite).toHaveBeenCalledWith({ key: 'rzp_test_abc', amount: 1_200_000 })
    expect(render).toHaveBeenCalledOnce()
  })

  it('reports false when the script is missing or throws, so the plain line stays', () => {
    expect(renderAffordability({}, { key: 'k', amount: 1 })).toBe(false)
    const Broken = vi.fn(() => {
      throw new Error('bad key')
    })
    expect(
      renderAffordability({ RazorpayAffordabilitySuite: Broken as never }, { key: 'k', amount: 1 }),
    ).toBe(false)
  })
})

describe('one widget per page', () => {
  it('lets the first block claim the slot and the next one wait', () => {
    const a = {}
    const b = {}
    expect(claimAffordabilitySlot(a)).toBe(true)
    expect(claimAffordabilitySlot(a)).toBe(true)
    expect(claimAffordabilitySlot(b)).toBe(false)
    releaseAffordabilitySlot(b)
    expect(claimAffordabilitySlot(b)).toBe(false)
    releaseAffordabilitySlot(a)
    expect(claimAffordabilitySlot(b)).toBe(true)
  })
})

describe('isDarkTheme', () => {
  const root = (theme: string | null) => ({ getAttribute: () => theme })

  it('follows an explicit theme over the device', () => {
    expect(isDarkTheme(root('dark'), false)).toBe(true)
    expect(isDarkTheme(root('light'), true)).toBe(false)
  })

  it('follows the device when the store has no explicit theme', () => {
    expect(isDarkTheme(root(null), true)).toBe(true)
    expect(isDarkTheme(root(null), false)).toBe(false)
  })
})
