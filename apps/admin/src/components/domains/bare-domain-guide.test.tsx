// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { LocaleContext } from '@/hooks/use-copy'
import { loadHindi } from '@/lib/hindi'
import BareDomainGuide from './bare-domain-guide'

const targets = { aRecord: '13.232.151.16', cnameTarget: 'shops.koomerce.app' }

describe('BareDomainGuide', () => {
  // The Hindi overlays load on demand (`lib/hindi.ts`), as LocaleProvider does in the app.
  beforeAll(() => loadHindi())

  it('shows the apex A record and the www CNAME with their values', () => {
    render(<BareDomainGuide apex="brand.in" targets={targets} apexRedirectOnly={false} />)
    expect(screen.getByText('brand.in: A record, name @, value 13.232.151.16')).toBeTruthy()
    expect(
      screen.getByText('www.brand.in: CNAME record, name www, value shops.koomerce.app'),
    ).toBeTruthy()
    expect(screen.getByText(/you can point it at the www value/)).toBeTruthy()
  })

  it('warns against ALIAS when the apex only redirects', () => {
    render(<BareDomainGuide apex="brand.in" targets={targets} apexRedirectOnly />)
    expect(screen.getByText(/Use the A record even if/)).toBeTruthy()
    expect(screen.queryByText(/you can point it at the www value/)).toBeNull()
  })

  it('reads in Hindi', () => {
    render(
      <LocaleContext.Provider value="hi">
        <BareDomainGuide apex="brand.in" targets={targets} apexRedirectOnly />
      </LocaleContext.Provider>,
    )
    expect(screen.getByText('बिना www वाले डोमेन के रिकॉर्ड')).toBeTruthy()
  })
})
