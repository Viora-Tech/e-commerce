// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductPicker from './product-picker'

const products = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: { products } }))

const row = (id: string, title: string) => ({ id, title, imageUrl: null })
const OLD = '00000000-0000-4000-8000-000000000001'
const GONE = '00000000-0000-4000-8000-000000000002'

beforeEach(() => {
  // The first page of the store (search results) never holds the picked products: a store
  // with more than one page of products, as in #516.
  products.list.mockReset().mockImplementation(async (input: { ids?: string[] }) => ({
    items: input.ids ? input.ids.filter((id) => id === OLD).map(() => row(OLD, 'Old pad')) : [],
    total: 0,
  }))
})

describe('ProductPicker', () => {
  it('shows a picked product that is not on the first page, with its amount field', async () => {
    render(
      <ProductPicker
        selected={[OLD]}
        onChange={() => undefined}
        rowExtra={(p) => <input aria-label={`amount ${p.title}`} />}
      />,
    )
    expect(await screen.findByText('Old pad')).toBeTruthy()
    expect(screen.getByLabelText('amount Old pad')).toBeTruthy()
    expect(products.list).toHaveBeenCalledWith(expect.objectContaining({ ids: [OLD] }))
  })

  it('stops asking once a picked product turns out to be gone', async () => {
    render(<ProductPicker selected={[OLD, GONE]} onChange={() => undefined} />)
    expect(await screen.findByText('Old pad')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 100))
    // Once for both, once more for the one still missing; then it settles (it used to loop).
    expect(products.list.mock.calls.filter(([input]) => input.ids).length).toBeLessThanOrEqual(2)
  })
})
