import { describe, expect, it } from 'vitest'
import { fieldForClick, pictureName, plainText } from './customize-field-target'

describe('fieldForClick', () => {
  const props = {
    id: 'hero-1',
    heading: '<p>Summer <strong>sale</strong></p>',
    subheading: 'Up to 50% off everything',
    buttonLabel: 'Shop now',
    image: { url: 'https://cdn.example/media/beach.jpg', alt: '' },
    slides: [{ title: 'Kurta week', image: { url: 'https://cdn.example/media/kurta.png' } }],
    _hidden: false,
  }

  it('finds the prop with the same words, tags and spacing aside', () => {
    expect(fieldForClick(props, { image: null, text: ' Summer  sale ' })).toEqual({
      field: 'heading',
      image: false,
    })
    expect(fieldForClick(props, { image: null, text: 'Shop now' })?.field).toBe('buttonLabel')
  })

  it('falls back to the prop that holds the words, and lists by their item', () => {
    expect(fieldForClick(props, { image: null, text: '50% off' })?.field).toBe('subheading')
    expect(fieldForClick(props, { image: null, text: 'Kurta week' })?.field).toBe('slides')
    expect(fieldForClick(props, { image: null, text: 'xy' })).toBeNull()
  })

  it('matches a picture at any size, and a list picture as the list', () => {
    expect(
      fieldForClick(props, {
        image: '/_next/image?url=https%3A%2F%2Fcdn.example%2Fmedia%2Fbeach-640.webp&w=640',
        text: '',
      }),
    ).toEqual({ field: 'image', image: true })
    expect(
      fieldForClick(props, { image: 'https://cdn.example/media/kurta_1280w.avif', text: '' }),
    ).toEqual({
      field: 'slides',
      image: false,
    })
  })

  it('normalises words and picture names', () => {
    expect(plainText('<b>Hi</b>&nbsp;there')).toBe('hi there')
    expect(pictureName('https://x/a/Photo-320.WEBP?v=2')).toBe('photo')
  })
})
