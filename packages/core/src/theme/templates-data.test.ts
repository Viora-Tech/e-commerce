/** SOURCE OF TRUTH: template data tests — WHAT: default templates and dropping Liquid sections / WHY: templates stay valid after import */
import { describe, expect, it } from 'vitest'
import { defaultTemplate, withoutLiquidSections } from './templates-data'

const liquid = (key: string, hidden = false) => ({
  type: 'LiquidSection',
  props: { id: `LiquidSection-${key}`, sectionType: key, ...(hidden ? { _hidden: true } : {}) },
})
const ours = (type: string, id: string, hidden = false) => ({
  type,
  props: { id, ...(hidden ? { _hidden: true } : {}) },
})

describe('defaultTemplate', () => {
  // The Zero Drift pack (Waimers' own theme) is opt-in; a new store starts on our sections only.
  const PACK_ONLY = ['MobileDock', 'SignupPopup', 'WhatsappChat', 'DiscordCta', 'ShipsToday']
  const WAIMERS_COPY = /waimers|glasspad|glass-mousepad|discord|lofree|find-your-match|sonipat/i

  it('starts a new store on our generic sections, with neutral copy', () => {
    for (const key of ['header', 'home', 'footer'] as const) {
      const template = defaultTemplate(key)
      for (const s of template.content) expect(PACK_ONLY, `${key}: ${s.type}`).not.toContain(s.type)
      expect(JSON.stringify(template), key).not.toMatch(WAIMERS_COPY)
    }
  })

  it('sets the copy the blocks would otherwise fill with Zero Drift words', () => {
    const header = defaultTemplate('header').content
    expect(header.map((s) => s.type)).toEqual(['AnnouncementBar', 'Header'])
    expect(header[0]?.props.announcements).toEqual([
      { text: '<p>Welcome to our store</p>', link: '' },
    ])
    expect(header[1]?.props.featureCards).toEqual([])
    const footer = defaultTemplate('footer').content
    expect(footer.map((s) => s.type)).toEqual(['Newsletter', 'Footer', 'CookieBanner'])
    expect(footer[1]?.props.helpCards).toEqual([])
    const home = defaultTemplate('home').content
    expect(home.map((s) => s.type)).toEqual(['Hero', 'ProductGrid', 'RichText'])
  })

  it('hands back a fresh copy each time', () => {
    const slides = (key: 'home') => defaultTemplate(key).content[0]?.props.slides as unknown[]
    const first = defaultTemplate('home').content[0]?.props.slides as unknown[]
    first.length = 0
    expect(slides('home')).toHaveLength(1)
  })
})

describe('withoutLiquidSections', () => {
  it('leaves a template without Shopify sections exactly as stored', () => {
    const stored = { root: { props: { title: 'x' } }, content: [ours('Hero', 'hero')], zones: {} }
    expect(withoutLiquidSections('home', stored)).toBe(stored)
    expect(withoutLiquidSections('home', 'not a template')).toBe('not a template')
  })

  it('keeps our sections and drops the Shopify ones', () => {
    const stored = {
      root: { props: {} },
      content: [liquid('banner'), ours('MainProduct', 'main'), liquid('related')],
    }
    expect(withoutLiquidSections('product', stored)).toEqual({
      root: { props: {} },
      content: [ours('MainProduct', 'main')],
    })
  })

  it('falls back to our default when nothing visible is left', () => {
    const allLiquid = { root: { props: {} }, content: [liquid('hero'), liquid('footer')] }
    expect(withoutLiquidSections('home', allLiquid)).toEqual(defaultTemplate('home'))
    expect(withoutLiquidSections('footer', allLiquid)).toEqual(defaultTemplate('footer'))
    const onlyHidden = {
      root: { props: {} },
      content: [liquid('hero'), ours('RichText', 'rich', true)],
    }
    expect(withoutLiquidSections('page', onlyHidden)).toEqual(defaultTemplate('page'))
  })
})

describe('account and sign-in templates', () => {
  it('start as just their main section, so the pages look as they did before templates', () => {
    expect(defaultTemplate('account').content).toEqual([
      { type: 'MainAccount', props: { id: 'main' } },
    ])
    expect(defaultTemplate('login').content).toEqual([{ type: 'MainLogin', props: { id: 'main' } }])
  })
})
