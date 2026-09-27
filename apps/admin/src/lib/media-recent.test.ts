import { describe, expect, it } from 'vitest'
import { parseRecentMedia, pushRecentMedia } from './media-recent'

const item = (id: string) => ({
  id,
  url: `/m/${id}.jpg`,
  alt: null,
  key: null,
  contentType: 'image/jpeg',
  size: null,
})

describe('recent media', () => {
  it('puts new picks first, once each, up to the cap', () => {
    expect(pushRecentMedia([item('a'), item('b')], [item('b')]).map((m) => m.id)).toEqual([
      'b',
      'a',
    ])
    const many = ['1', '2', '3', '4', '5', '6'].map(item)
    expect(pushRecentMedia(many, [item('x')]).map((m) => m.id)).toEqual([
      'x',
      '1',
      '2',
      '3',
      '4',
      '5',
    ])
  })

  it('reads stored recents defensively', () => {
    expect(parseRecentMedia(JSON.stringify([item('a'), { id: 1 }]))).toEqual([item('a')])
    expect(parseRecentMedia('{')).toEqual([])
    expect(parseRecentMedia(null)).toEqual([])
  })
})
