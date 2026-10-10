// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { customizeContent } from '@/data/customize'
import { EDITOR_HELP_URL } from './customize-rail'
import HelpPanel from './help-panel'

const copy = customizeContent.help

describe('HelpPanel', () => {
  it('lists every shortcut with its keys', () => {
    render(<HelpPanel />)
    for (const name of Object.values(copy.keys)) expect(screen.getByText(name)).toBeTruthy()
    expect(screen.getByText('Esc')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
  })

  it('links to the editor guide and says what is new', () => {
    render(<HelpPanel />)
    expect(screen.getByText(copy.guide).closest('a')?.getAttribute('href')).toBe(EDITOR_HELP_URL)
    for (const item of copy.news) expect(screen.getByText(item)).toBeTruthy()
  })
})
