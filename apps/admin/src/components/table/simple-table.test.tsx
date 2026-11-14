// @vitest-environment jsdom
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HEAD, SIMPLE_BODY } from './resource-table/styles'
import SimpleTable from './simple-table'

describe('SimpleTable', () => {
  it('draws the header cells with the list table header and aligns them', () => {
    render(
      <SimpleTable
        label="Searches"
        columns={[
          { key: 'q', label: 'Search' },
          { key: 'n', label: 'Searches', align: 'end', className: 'w-24' },
        ]}
      >
        <TableRow>
          <TableCell>shoes</TableCell>
          <TableCell>12</TableCell>
        </TableRow>
      </SimpleTable>,
    )
    const heads = screen.getAllByRole('columnheader')
    expect(heads.map((h) => h.textContent)).toEqual(['Search', 'Searches'])
    for (const cls of HEAD.split(' ').filter(
      (c) => !c.startsWith('first:') && !c.startsWith('last:'),
    )) {
      expect(heads[0]?.className).toContain(cls)
    }
    expect(heads[1]?.className).toContain('text-right')
    expect(heads[1]?.className).toContain('w-24')
    expect(screen.getByRole('table', { name: 'Searches' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'shoes' })).toBeTruthy()
  })

  it('gives body cells the list row height, or the compact one', () => {
    const { rerender } = render(
      <SimpleTable columns={[{ key: 'a', label: 'A' }]}>
        <TableRow>
          <TableCell>x</TableCell>
        </TableRow>
      </SimpleTable>,
    )
    expect(screen.getByRole('table').className).toContain(SIMPLE_BODY.list.split(' ')[0])
    rerender(
      <SimpleTable density="compact" columns={[{ key: 'a', label: 'A' }]}>
        <TableRow>
          <TableCell>x</TableCell>
        </TableRow>
      </SimpleTable>,
    )
    expect(screen.getByRole('table').className).toContain('[&_tbody_td:not([colspan])]:h-10')
  })

  it('renders footer rows when given', () => {
    render(
      <SimpleTable
        columns={[{ key: 'a', label: 'A' }]}
        footer={
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        }
      >
        <TableRow>
          <TableCell>x</TableCell>
        </TableRow>
      </SimpleTable>,
    )
    expect(screen.getByText('Total').closest('tfoot')).toBeTruthy()
  })
})
