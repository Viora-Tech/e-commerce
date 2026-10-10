import type { Theme } from '@commerce/core/theme'
import { describe, expect, it } from 'vitest'
import { auditTemplate } from './customize-audit'
import type { CustomizeDoc } from './customize-doc'

const doc = (content: CustomizeDoc['content']): CustomizeDoc => ({
  root: { props: {} },
  content,
  zones: {},
})

const defaults: Record<string, Record<string, unknown>> = {
  ImageBanner: { heading: 'Welcome' },
  RichText: { heading: '' },
}
const defaultsOf = (type: string) => defaults[type]

describe('auditTemplate', () => {
  it('finds pictures without a description and buttons that go nowhere, per block', () => {
    const issues = auditTemplate(
      doc([
        {
          type: 'ImageBanner',
          props: {
            id: 'banner',
            heading: 'Sale',
            image: { url: 'https://cdn.test/a.jpg', alt: '' },
            button: { label: 'Shop now', href: '' },
          },
        },
        {
          type: 'Gallery',
          props: {
            id: 'gallery',
            images: [
              { image: { url: 'https://cdn.test/1.jpg', alt: '' } },
              { image: { url: 'https://cdn.test/2.jpg', alt: ' ' } },
              { image: { url: 'https://cdn.test/3.jpg', alt: 'Pad' } },
              { image: { url: '', alt: '' } },
            ],
          },
        },
      ]),
      defaultsOf,
      null,
    )
    expect(issues).toEqual([
      { kind: 'alt', blockId: 'banner', type: 'ImageBanner', count: 1 },
      { kind: 'link', blockId: 'banner', type: 'ImageBanner', count: 1 },
      { kind: 'alt', blockId: 'gallery', type: 'Gallery', count: 2 },
    ])
  })

  it('flags a section hidden on every screen and an emptied heading, not a blank one by design', () => {
    const issues = auditTemplate(
      doc([
        {
          type: 'ImageBanner',
          props: {
            id: 'b',
            heading: '',
            settings: { advanced: { showOnMobile: false, showOnDesktop: false } },
          },
        },
        { type: 'RichText', props: { id: 'r', heading: '' } },
        {
          type: 'Group',
          props: { id: 'g', content: [{ type: 'Heading', props: { id: 'h', text: '' } }] },
        },
      ]),
      defaultsOf,
      null,
    )
    expect(issues.map((i) => `${i.blockId}:${i.kind}`)).toEqual([
      'b:hidden',
      'b:heading',
      'h:heading',
    ])
  })

  it('skips blocks hidden with the eye, and adds the theme colour pairs that fail AA', () => {
    const theme = {
      schemes: [
        {
          id: 'scheme-1',
          name: 'White',
          background: '#ffffff',
          text: '#eeeeee',
          textMuted: '#666666',
          line: '#e5e5e5',
          surface: '#ffffff',
          button: '#111111',
          buttonText: '#ffffff',
          accent: '#00fced',
        },
      ],
      lightScheme: 'scheme-1',
      darkScheme: 'scheme-1',
      darkMode: { enabled: false },
      shared: { success: '#16a34a', danger: '#dc2626', sale: '#dc2626' },
      sharedDark: { success: '#16a34a', danger: '#dc2626', sale: '#dc2626' },
      buttons: { colour: 'brand' },
    } as unknown as Theme
    const issues = auditTemplate(
      doc([
        {
          type: 'ImageBanner',
          props: { id: 'x', _hidden: true, image: { url: 'https://cdn.test/a.jpg', alt: '' } },
        },
      ]),
      defaultsOf,
      theme,
    )
    expect(issues.every((i) => i.kind === 'contrast')).toBe(true)
    expect(issues.some((i) => i.contrast?.pair === 'text')).toBe(true)
  })
})
