// @vitest-environment jsdom
import { SortableList } from '@commerce/ui/sortable'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { sectionSortLabels } from '@/data/customize'

const ITEMS = [
  { id: 'a', name: 'Hero' },
  { id: 'b', name: 'Featured products' },
]

/**
 * The Sections tree sits under the tab fade (`transform`) and a collapsible group
 * (`overflow: hidden`). The lifted copy of a dragged row is `position: fixed`, so inside them
 * it was shifted and clipped, and dnd-kit measured the shifted copy: rows could not be dropped.
 */
describe('the dragged row in the Sections tree', () => {
  it('is drawn on <body>, outside transformed and clipping panels', async () => {
    render(
      <div data-testid="panel" style={{ transform: 'translateY(0px)', overflow: 'hidden' }}>
        <SortableList
          items={ITEMS}
          onReorder={() => {}}
          getTitle={(i) => i.name}
          labels={sectionSortLabels}
          renderItem={(item, { handle }) => (
            <div>
              {handle}
              <span>{item.name}</span>
            </div>
          )}
        />
      </div>
    )
    const grip = screen.getByRole('button', { name: sectionSortLabels.handle('Hero') })
    await act(async () => {
      grip.focus()
      grip.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }))
    })
    const copies = screen.getAllByText('Hero')
    expect(copies).toHaveLength(2)
    const panel = screen.getByTestId('panel')
    const lifted = copies.find((el) => !panel.contains(el))
    expect(lifted).toBeDefined()
    expect(document.body.contains(lifted ?? null)).toBe(true)
  })
})
