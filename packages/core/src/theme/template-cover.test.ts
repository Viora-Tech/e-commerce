/** SOURCE OF TRUTH: theme cover tests — WHAT: the saved home page's first picture / WHY: the Themes page shows it instead of a swatch */
import { describe, expect, it } from 'vitest'
import { templateCover } from './template-cover'
import { comparableTemplate, stableTemplateJson } from './templates-data'

const POSTER = 'http://localhost:3200/uploads/stores/s/media/hero-poster.jpg'
const IMAGE = 'https://cdn.test/stores/s/media/banner.webp?v=2'

const hero = {
  type: 'LiquidSection',
  props: {
    id: 'LiquidSection-hero',
    blocks: [
      {
        type: 'video_slide',
        settings: {
          image: { url: IMAGE },
          video: {
            url: 'http://localhost:3200/uploads/stores/s/media/hero.mp4',
            poster: { url: POSTER, width: 1920, height: 1080 },
          },
        },
      },
    ],
  },
}

describe('templateCover', () => {
  it("prefers the hero video's poster", () => {
    expect(templateCover({ content: [hero] })).toBe(POSTER)
  })

  it('takes the first image when there is no poster', () => {
    const banner = { type: 'Hero', props: { id: 'h', image: IMAGE, title: 'Hi' } }
    expect(templateCover({ content: [banner] })).toBe(IMAGE)
  })

  it('skips a top strip with no picture, and hidden sections', () => {
    const strip = { type: 'Announcement', props: { id: 'a', text: 'Free shipping' } }
    const hidden = { type: 'Hero', props: { id: 'x', _hidden: true, image: '/a/hidden.png' } }
    expect(templateCover({ content: [strip, hidden, hero] })).toBe(POSTER)
  })

  it('ignores videos, Shopify-only addresses and pictures below the top', () => {
    const plain = (id: string) => ({ type: 'Text', props: { id } })
    const video = { type: 'Video', props: { id: 'v', url: 'https://cdn.test/a.mp4' } }
    const shopify = { type: 'Hero', props: { id: 's', image: 'shopify://shop_images/a.jpg' } }
    expect(templateCover({ content: [video, shopify, plain('c'), hero] })).toBeNull()
    expect(templateCover({ content: [] })).toBeNull()
    expect(templateCover(null)).toBeNull()
  })
})

describe('comparableTemplate', () => {
  it('treats an empty zones map as no zones, so an undone edit is no draft', () => {
    const saved = { root: { props: {} }, content: [hero] }
    const draft = { ...saved, zones: {} }
    expect(stableTemplateJson(comparableTemplate(draft))).toBe(
      stableTemplateJson(comparableTemplate(saved)),
    )
  })

  it('keeps zones that hold sections', () => {
    const draft = { root: { props: {} }, content: [], zones: { 'x:y': [hero] } }
    expect(comparableTemplate(draft).zones).toEqual({ 'x:y': [hero] })
  })
})
