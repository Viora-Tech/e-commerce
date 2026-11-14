// @vitest-environment jsdom
/** SOURCE OF TRUTH: RecordCombobox — WHAT: the one type-ahead record picker (inline, panel, popover) / WHY: design audit step 16, every picker searched and listed rows its own way (14 Nov 2026) */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RecordCombobox from './record-combobox'

type Row = { id: string; name: string }

const ROWS: Row[] = [
  { id: 'a', name: 'Asha' },
  { id: 'b', name: 'Bilal' },
]

function renderBox(props: Partial<Parameters<typeof RecordCombobox<Row>>[0]> = {}) {
  const onPick = vi.fn()
  const onQueryChange = vi.fn()
  render(
    <RecordCombobox<Row>
      placeholder="Search people"
      query=""
      onQueryChange={onQueryChange}
      items={ROWS}
      itemKey={(r) => r.id}
      renderItem={(r) => r.name}
      onPick={onPick}
      {...props}
    />,
  )
  return { onPick, onQueryChange }
}

afterEach(cleanup)

describe('RecordCombobox', () => {
  it('inline: lists rows under the search box and picks one', () => {
    const { onPick, onQueryChange } = renderBox()
    fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'as' } })
    expect(onQueryChange).toHaveBeenCalledWith('as')
    fireEvent.click(screen.getByRole('button', { name: 'Asha' }))
    expect(onPick).toHaveBeenCalledWith(ROWS[0])
  })

  it('inline: hides the list when nothing matches and ignores status', () => {
    renderBox({ items: [], status: 'Searching…' })
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByText('Searching…')).toBeNull()
  })

  it('marks the picked row and blocks disabled rows', () => {
    const { onPick } = renderBox({
      isSelected: (r) => r.id === 'a',
      isDisabled: (r) => r.id === 'b',
    })
    expect(screen.getByRole('button', { name: 'Asha' }).getAttribute('aria-pressed')).toBe('true')
    const bilal = screen.getByRole('button', { name: 'Bilal' }) as HTMLButtonElement
    expect(bilal.disabled).toBe(true)
    fireEvent.click(bilal)
    expect(onPick).not.toHaveBeenCalled()
  })

  it('panel: shows the status line in place of rows', () => {
    renderBox({ list: 'panel', items: [], status: 'Nothing found' })
    expect(screen.getByText('Nothing found')).toBeTruthy()
  })

  it('popover: opens on focus, closes on Escape, Enter picks the first row', () => {
    const { onPick } = renderBox({ list: 'popover', enterPicksFirst: true })
    const box = screen.getByRole('combobox')
    expect(screen.queryByRole('list')).toBeNull()
    fireEvent.focus(box)
    expect(screen.getByRole('list')).toBeTruthy()
    expect(box.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('list')).toBeNull()
    fireEvent.focus(box)
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(ROWS[0])
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('popover: reports open changes when controlled', () => {
    const onOpenChange = vi.fn()
    renderBox({ list: 'popover', open: false, onOpenChange })
    fireEvent.focus(screen.getByRole('combobox'))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })
})
