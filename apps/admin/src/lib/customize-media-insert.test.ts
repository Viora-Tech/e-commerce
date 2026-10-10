import { describe, expect, it } from 'vitest'
import type { CustomizeDoc } from './customize-doc'
import {
  type FieldShape,
  imageTargets,
  mediaAction,
  mediaTarget,
  withMedia,
} from './customize-media-insert'

const image: FieldShape = { type: 'object', objectFields: { url: {}, alt: {} } }
const fields: Record<string, FieldShape> = {
  heading: { type: 'text' },
  image,
  slides: { type: 'array', arrayFields: { image, heading: { type: 'text' } } },
  settings: { type: 'object', objectFields: { style: { type: 'object' } } },
}

describe('imageTargets / mediaTarget', () => {
  it('lists picture settings at the top and inside list items, skipping section settings', () => {
    const props = {
      image: { url: 'a.jpg', alt: '' },
      slides: [{ image: { url: '' } }, { image: {} }],
    }
    expect(imageTargets(fields, props)).toEqual([
      { path: ['image'], filled: true },
      { path: ['slides', 0, 'image'], filled: false },
      { path: ['slides', 1, 'image'], filled: false },
    ])
    expect(mediaTarget(fields, props)).toEqual(['slides', 0, 'image'])
  })

  it('falls back to the first picture when all are filled, and to null with none', () => {
    expect(mediaTarget(fields, { image: { url: 'a.jpg' }, slides: [] })).toEqual(['image'])
    expect(mediaTarget({ heading: { type: 'text' } }, {})).toBeNull()
  })
})

describe('withMedia', () => {
  it('sets the picture, keeps a written description and drops the old focal point', () => {
    const props = { slides: [{ image: { url: 'old.jpg', alt: 'Pad', focal: { x: 1, y: 2 } } }] }
    expect(
      withMedia(props, ['slides', 0, 'image'], { url: 'new.jpg', alt: 'Library alt' }),
    ).toEqual({
      slides: [{ image: { url: 'new.jpg', alt: 'Pad' } }],
    })
    expect(withMedia({}, ['image'], { url: 'new.jpg', alt: 'From library' })).toEqual({
      image: { url: 'new.jpg', alt: 'From library' },
    })
  })
})

describe('mediaAction', () => {
  it('replaces the block where it sits, nested ones included', () => {
    const doc: CustomizeDoc = {
      root: { props: {} },
      content: [
        {
          type: 'Group',
          props: {
            id: 'g',
            content: [{ type: 'ImageBanner', props: { id: 'b', image: { url: '', alt: '' } } }],
          },
        },
      ],
      zones: {},
    }
    const action = mediaAction(doc, (t) => (t === 'ImageBanner' ? fields : {}), 'b', {
      url: 'x.jpg',
      alt: null,
    })
    expect(action).toMatchObject({
      type: 'replace',
      destinationZone: 'g:content',
      destinationIndex: 0,
      data: { props: { id: 'b', image: { url: 'x.jpg', alt: '' } } },
    })
    expect(mediaAction(doc, () => ({}), 'g', { url: 'x.jpg', alt: null })).toBeNull()
  })
})
