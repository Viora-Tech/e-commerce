// @vitest-environment jsdom
import { Table, TableBody, TableCell } from '@commerce/ui/shadcn/table'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LinkRow from './link-row'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

function renderRow() {
  render(
    <Table>
      <TableBody>
        <LinkRow href="/products/p1">
          <TableCell>Mouse</TableCell>
          <TableCell>
            <button type="button">Menu</button>
          </TableCell>
        </LinkRow>
      </TableBody>
    </Table>,
  )
}

afterEach(() => {
  push.mockReset()
  vi.restoreAllMocks()
})

describe('LinkRow', () => {
  it('opens the page on a left click', () => {
    renderRow()
    fireEvent.click(screen.getByText('Mouse'))
    expect(push).toHaveBeenCalledWith('/products/p1')
  })

  it('opens a new tab on a middle click or Ctrl-click', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderRow()
    fireEvent(
      screen.getByText('Mouse'),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
    )
    fireEvent.click(screen.getByText('Mouse'), { ctrlKey: true })
    expect(open).toHaveBeenCalledTimes(2)
    expect(open).toHaveBeenCalledWith('/products/p1', '_blank', 'noopener')
    expect(push).not.toHaveBeenCalled()
  })

  it('leaves a control inside the row and a right click alone', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderRow()
    fireEvent.click(screen.getByText('Menu'))
    fireEvent(
      screen.getByText('Mouse'),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }),
    )
    expect(push).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})
