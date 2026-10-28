import type { MarketPricing } from '@commerce/money'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Money from '../src/components/money'
import MoneyFormatProvider from '../src/components/money-format-provider'
import Price from '../src/components/price'

const USD: MarketPricing = { currency: 'USD', rate: 0.012, adjustmentBp: 0, rounding: 'x99' }

describe('prices on a market in another currency', () => {
  it('shows every price block in the market currency', () => {
    const html = renderToStaticMarkup(
      <MoneyFormatProvider format="Rs. {{amount}}" pricing={USD}>
        <Price pricePaise={64_900} mrpPaise={99_900} />
        <Money paise={64_900} />
      </MoneyFormatProvider>,
    )
    // ₹649 → $7.99, ₹999 → $11.99
    expect(html).toContain('$7.99')
    expect(html).toContain('$11.99')
    expect(html).not.toContain('Rs.')
  })

  it('keeps the store’s own format without a market', () => {
    const html = renderToStaticMarkup(
      <MoneyFormatProvider format="Rs. {{amount}}">
        <Money paise={64_900} />
      </MoneyFormatProvider>,
    )
    expect(html).toContain('Rs. 649.00')
  })
})
