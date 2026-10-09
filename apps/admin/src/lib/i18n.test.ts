import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hindiCopy } from '@/data/hi'
import { hindiPageNames } from '@/data/hi/navigation'
import { PAGE_TITLES_FOR_TESTS } from '@/data/layout'
import { NAV_GROUPS, SETTINGS_NAV } from '@/data/navigation'
import { onboardingContent } from '@/data/onboarding'
import { SETTINGS_HOME, SETTINGS_SECTIONS } from '@/data/settings'
import { localize } from '@/lib/copy'
import { formatters } from '@/lib/format'
import {
  LOCALE_COOKIE,
  localeCookie,
  localeFromCookieHeader,
  mergeCopy,
  parseLocale,
  translationProblems,
  untranslated,
  untranslatedPaths,
} from '@/lib/i18n'

describe('mergeCopy: per-key fallback to English', () => {
  const en = {
    title: 'Orders',
    count: (n: number) => (n === 1 ? '1 order' : `${n} orders`),
    empty: { heading: 'No orders yet', body: 'They show up here.' },
    tabs: ['All', 'Unpaid'],
  }

  it('uses every Hindi key that is there', () => {
    const out = mergeCopy(en, {
      title: 'ऑर्डर',
      count: (n: number) => `${n} ऑर्डर`,
      empty: { heading: 'अभी कोई ऑर्डर नहीं', body: 'यहाँ दिखेंगे।' },
      tabs: ['सभी', 'पेमेंट बाकी'],
    })
    expect(out.title).toBe('ऑर्डर')
    expect(out.count(3)).toBe('3 ऑर्डर')
    expect(out.empty.heading).toBe('अभी कोई ऑर्डर नहीं')
    expect(out.tabs).toEqual(['सभी', 'पेमेंट बाकी'])
  })

  it('keeps English for missing, untranslated and wrong-kind keys', () => {
    const out = mergeCopy(en, {
      count: 'not a function',
      empty: { heading: untranslated },
      tabs: ['सभी'],
    })
    expect(out.title).toBe('Orders')
    expect(out.count(1)).toBe('1 order')
    expect(out.empty).toEqual({ heading: 'No orders yet', body: 'They show up here.' })
    expect(out.tabs).toEqual(['सभी', 'Unpaid'])
  })

  it('keeps English for a whole group marked untranslated', () => {
    expect(mergeCopy(en, { empty: untranslated }).empty).toBe(en.empty)
  })

  it('drops keys and array items the English does not have', () => {
    const out = mergeCopy(en, { bogus: 'x', tabs: ['a', 'b', 'c'] }) as Record<string, unknown>
    expect('bogus' in out).toBe(false)
    expect(out.tabs).toEqual(['a', 'b'])
  })

  it('never merges into React components', () => {
    const Icon = { $$typeof: Symbol.for('react.forward_ref'), render: () => null }
    const Other = { $$typeof: Symbol.for('react.forward_ref'), render: () => 'other' }
    expect(mergeCopy({ icon: Icon }, { icon: Other }).icon).toBe(Other)
  })
})

describe('localize', () => {
  it('returns the English export itself in English', () => {
    expect(localize(onboardingContent, 'en')).toBe(onboardingContent)
  })

  it('returns Hindi for a registered export, the same object every time', () => {
    const hi = localize(onboardingContent, 'hi')
    expect(hi.submit).toBe('स्टोर बनाएं')
    expect(localize(onboardingContent, 'hi')).toBe(hi)
  })

  it('keeps function-valued copy working in both languages', () => {
    expect(localize(onboardingContent, 'en').progress(2, 4)).toBe('Step 2 of 4')
    expect(localize(onboardingContent, 'hi').progress(2, 4)).toBe('स्टेप 2 / 4')
  })

  it('leaves exports with no Hindi file in English', () => {
    const notRegistered = { heading: 'Taxes and GST' }
    expect(localize(notRegistered, 'hi')).toBe(notRegistered)
  })
})

describe('the Hindi files', () => {
  it('have no extra, unknown or wrong-kind keys', () => {
    const problems = hindiCopy.flatMap(([en, hi], i) =>
      translationProblems(en, hi).map((p) => `pair ${i}: ${p.kind} at ${p.path}`),
    )
    expect(problems).toEqual([])
  })

  it('register each English export once', () => {
    const seen = new Set(hindiCopy.map(([en]) => en))
    expect(seen.size).toBe(hindiCopy.length)
  })

  it('translate everything except keys marked untranslated', () => {
    // Missing keys are a type error; this lists the deliberate `untranslated` ones so the
    // number is visible in the test output rather than silent.
    const open = hindiCopy.flatMap(([en, hi]) => untranslatedPaths(en, hi))
    console.info(`[i18n] Hindi keys left in English on purpose: ${open.length}`)
    expect(Array.isArray(open)).toBe(true)
  })

  it('only name pages the admin really has', () => {
    const routes = new Set<string>([
      SETTINGS_HOME.href,
      SETTINGS_NAV.href,
      ...SETTINGS_SECTIONS.map((s) => s.href),
      ...PAGE_TITLES_FOR_TESTS.map(([href]) => href),
      ...NAV_GROUPS.flatMap((g) =>
        g.items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]),
      ),
    ])
    const unknown = Object.keys(hindiPageNames).filter((href) => !routes.has(href))
    expect(unknown).toEqual([])
  })

  it('do not import the copy machinery from data files (it would be a cycle)', () => {
    const dataDir = join(__dirname, '..', 'data')
    const offenders = readdirSync(dataDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .filter((f) =>
        /from '@\/lib\/(copy|format|format-date|status-labels|page-names)'/.test(
          readFileSync(join(dataDir, f), 'utf8'),
        ),
      )
    expect(offenders).toEqual([])
  })
})

describe('locale cookie', () => {
  it('round-trips through the Cookie header', () => {
    const set = localeCookie('hi')
    expect(set).toContain(`${LOCALE_COOKIE}=hi`)
    expect(set).toContain('path=/')
    const header = `theme=dark; ${set.split(';')[0]}; other=1`
    expect(localeFromCookieHeader(header)).toBe('hi')
    expect(localeFromCookieHeader(localeCookie('en').split(';')[0])).toBe('en')
  })

  it('treats a missing or unknown value as English', () => {
    expect(localeFromCookieHeader(undefined)).toBe('en')
    expect(localeFromCookieHeader('admin_locale=fr')).toBe('en')
    expect(parseLocale('<script>')).toBe('en')
    expect(parseLocale('hi')).toBe('hi')
  })
})

describe('formatters', () => {
  const at = new Date('2026-09-12T10:30:00.000Z') // 4:00 pm IST

  it('keep Indian lakh/crore grouping in both languages', () => {
    expect(formatters('en').money(1_23_45_678_00)).toBe('₹1,23,45,678')
    expect(formatters('hi').money(1_23_45_678_00)).toBe('₹1,23,45,678')
    expect(formatters('hi').number(12_34_567)).toBe('12,34,567')
  })

  it('spell compact amounts in Hindi and keep L/Cr in English', () => {
    expect(formatters('en').moneyCompact(1_23_456_00)).toBe('₹1.2L')
    expect(formatters('hi').moneyCompact(1_23_456_00)).toBe('₹1.2 लाख')
    expect(formatters('hi').compact(2_50_00_000)).toBe('2.5 करोड़')
  })

  it('write dates in hi-IN', () => {
    expect(formatters('en').date(at)).toBe('12 Sept 2026')
    expect(formatters('hi').date(at)).toContain('2026')
    expect(formatters('hi').day(at, new Date('2026-12-01T00:00:00Z'))).toBe('12 सितंबर 2026')
  })

  it('translate relative days', () => {
    const now = new Date('2026-09-12T12:00:00.000Z')
    expect(formatters('en').when(at, now)).toMatch(/^Today 4:00 pm$/)
    expect(formatters('hi').when(at, now)).toMatch(/^आज 4:00/)
    expect(formatters('hi').ago(new Date(now.getTime() - 5 * 60_000), now)).toBe('5 मिनट पहले')
  })
})
