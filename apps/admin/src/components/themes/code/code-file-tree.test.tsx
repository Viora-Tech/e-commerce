// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CodeFileEntry } from '@/lib/theme-code'
import CodeFileTree from './code-file-tree'

const file = (path: string, draft = false) =>
  ({ path, size: 1, binary: false, editable: true, readOnlyReason: null, draft }) as CodeFileEntry

const FILES = [
  file('layout/theme.liquid', true),
  file('snippets/revamp-header-float.liquid', true),
  file('sections/header.liquid'),
]

function tree(active: string | null = null) {
  return render(
    <CodeFileTree
      files={FILES}
      library={[]}
      active={active}
      dirty={new Set()}
      broken={new Set()}
      justPublished={new Set()}
      canAdd={false}
      onOpen={() => undefined}
      onAdd={() => undefined}
    />,
  )
}

describe('CodeFileTree', () => {
  it('starts with every folder closed', () => {
    tree()
    for (const b of screen.getAllByRole('button', { expanded: false })) {
      expect(b.getAttribute('aria-expanded')).toBe('false')
    }
    expect(screen.queryByText('theme.liquid')).toBeNull()
  })

  it('opens only the folder of the open file', () => {
    tree('snippets/revamp-header-float.liquid')
    expect(screen.getByText('revamp-header-float.liquid')).toBeTruthy()
    expect(screen.queryByText('theme.liquid')).toBeNull()
  })

  it('shows the unpublished dot on folders holding drafts, not on clean ones', () => {
    tree()
    const folders = screen.getAllByRole('button', { expanded: false })
    const withDot = folders.filter((b) => b.querySelector('[role="img"]'))
    expect(withDot.map((b) => b.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/layout/i),
        expect.stringMatching(/snippets/i),
      ]),
    )
    expect(withDot.some((b) => /sections/i.test(b.textContent ?? ''))).toBe(false)
  })

  it('opens and closes a folder by hand', () => {
    tree()
    const layout = screen.getAllByRole('button').find((b) => /layout/i.test(b.textContent ?? ''))
    if (!layout) throw new Error('no layout folder')
    fireEvent.click(layout)
    expect(screen.getByText('theme.liquid')).toBeTruthy()
    fireEvent.click(layout)
    expect(screen.queryByText('theme.liquid')).toBeNull()
  })
})
