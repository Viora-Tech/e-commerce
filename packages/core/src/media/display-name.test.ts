import { describe, expect, it } from 'vitest'
import { uploadedName } from './display-name'

describe('uploadedName', () => {
  it('keeps the file name without its extension', () => {
    expect(uploadedName('Mouse pad_final.JPG')).toBe('Mouse pad_final')
    expect(uploadedName('C:\fakepath\hero.webp')).toBe('hero')
  })

  it('is null for a name that is only an extension or blank', () => {
    expect(uploadedName('.png')).toBeNull()
    expect(uploadedName('  ')).toBeNull()
  })
})
