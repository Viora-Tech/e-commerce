// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppliesToPicker from './applies-to-picker'

const products = vi.hoisted(() => ({ list: vi.fn() }))
const collections = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: { products, collections } }))

const row = (id: string, title: string) => ({
  id,
  title,
  imageUrl: null,
  minPricePaise: 49_900,
  available: 3,
})
const OLD = '00000000-0000-4000-8000-000000000001'
const GONE = '00000000-0000-4000-8000-000000000002'
const SALE = '00000000-0000-4000-8000-000000000003'

beforeEach(() => {
  // The first page of the store never holds the picked products: a store with more than one
  // page of products, as in #516.
  products.list.mockReset().mockImplementation(async (input: { ids?: string[] }) => ({
    items: input.ids ? input.ids.filter((id) => id === OLD).map(() => row(OLD, 'Old pad')) : [],
    total: 0,
  }))
  collections.list
    .mockReset()
    .mockResolvedValue([{ id: SALE, title: 'Diwali sale', imageUrl: null, productCount: 12 }])
})

describe('AppliesToPicker', () => {
  it('shows a picked product that is not on the first page, with its amount field', async () => {
    render(
      <AppliesToPicker
        kind="products"
        ids={[OLD]}
        onChange={() => undefined}
        rowExtra={(p) => <input aria-label={`amount ${p.title}`} />}
      />,
    )
    expect(await screen.findByText('Old pad')).toBeTruthy()
    expect(screen.getByLabelText('amount Old pad')).toBeTruthy()
    expect(products.list).toHaveBeenCalledWith(expect.objectContaining({ ids: [OLD] }))
  })

  it('stops asking once a picked product turns out to be gone', async () => {
    render(<AppliesToPicker kind="products" ids={[OLD, GONE]} onChange={() => undefined} />)
    expect(await screen.findByText('Old pad')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 100))
    // Once for both, once more for the one still missing; then it settles (it used to loop).
    expect(products.list.mock.calls.filter(([input]) => input.ids).length).toBeLessThanOrEqual(2)
  })

  it('shows picked collections with their product count', async () => {
    render(<AppliesToPicker kind="collections" ids={[SALE]} onChange={() => undefined} />)
    expect(await screen.findByText('Diwali sale')).toBeTruthy()
    expect(screen.getByText('12 products')).toBeTruthy()
  })
})
