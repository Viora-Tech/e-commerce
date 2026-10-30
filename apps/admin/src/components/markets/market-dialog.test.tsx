// @vitest-environment jsdom
import type { DomainView, MarketView } from '@commerce/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MarketDialog from './market-dialog'

const markets = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: { markets } }))

const market = (fields: Partial<MarketView>): MarketView => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'India',
  handle: 'india',
  isPrimary: false,
  enabled: true,
  currency: 'INR',
  locale: 'en',
  locales: [],
  subfolder: null,
  catalogId: null,
  storeDomainId: null,
  priceAdjustmentBp: 0,
  rounding: 'none',
  manualRate: null,
  duties: 'dap',
  countries: [],
  hostname: null,
  ...fields,
})

const india = market({ isPrimary: true, countries: ['IN'] })
const gulf = market({
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Gulf',
  handle: 'gulf',
  currency: 'AED',
  subfolder: 'ae',
  locales: ['ar'],
  countries: ['AE', 'SA'],
})
const domains = [
  { id: 'd1', hostname: 'waimers.koomerce.app', isPrimary: true, status: 'active' },
] as DomainView[]

beforeEach(() => {
  markets.create.mockReset().mockResolvedValue(undefined)
  markets.update.mockReset().mockResolvedValue(undefined)
})

describe('MarketDialog', () => {
  it('fills the currency and subfolder from the first country, and adds the market', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(
      <MarketDialog
        market={null}
        markets={[india]}
        domains={domains}
        onClose={() => undefined}
        onSaved={onSaved}
      />,
    )
    await user.type(screen.getByLabelText('Name'), 'Europe')
    await user.type(screen.getByPlaceholderText('Search countries'), 'germ')
    await user.click(screen.getByText('Germany'))
    expect(screen.getByText('EUR · Euro')).toBeTruthy()
    expect((screen.getByLabelText('Subfolder') as HTMLInputElement).value).toBe('de')
    await user.click(screen.getByRole('button', { name: 'Add market' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(markets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Europe',
        countries: ['DE'],
        currency: 'EUR',
        subfolder: 'de',
        storeDomainId: null,
        priceAdjustmentBp: 0,
        manualRate: null,
      }),
    )
  })

  it('names the market that already has a country, and refuses its address', async () => {
    const user = userEvent.setup()
    render(
      <MarketDialog
        market={null}
        markets={[india, gulf]}
        domains={domains}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    )
    await user.type(screen.getByPlaceholderText('Search countries'), 'saudi')
    expect(screen.getByText('In Gulf')).toBeTruthy()
    await user.type(screen.getByLabelText('Subfolder'), 'ar-ae')
    expect(screen.getByText('/ar-ae already opens Gulf.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Add market' }))
    expect(markets.create).not.toHaveBeenCalled()
  })

  it('lets the primary market change only its name and languages', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(
      <MarketDialog
        market={india}
        markets={[india, gulf]}
        domains={domains}
        onClose={() => undefined}
        onSaved={onSaved}
      />,
    )
    expect(screen.queryByPlaceholderText('Search countries')).toBeNull()
    expect(screen.queryByText('How shoppers reach it')).toBeNull()
    expect(screen.getByText(/This is your primary market/)).toBeTruthy()
    await user.click(screen.getByRole('checkbox', { name: 'Hindi' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(markets.update).toHaveBeenCalledWith({
      id: india.id,
      name: 'India',
      locale: 'en',
      locales: ['hi'],
    })
  })
})
