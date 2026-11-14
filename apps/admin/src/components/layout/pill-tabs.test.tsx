// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PillTabs from './pill-tabs'

vi.mock('motion/react', () => ({
  motion: {
    span: (props: Record<string, unknown>) => <span className={String(props.className)} />,
  },
  useReducedMotion: () => true,
}))

const TABS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', count: 3 },
]

describe('PillTabs', () => {
  it('is a tablist of buttons that calls onChange', () => {
    const onChange = vi.fn()
    render(<PillTabs label="Views" tabs={TABS} value="a" onChange={onChange} />)
    expect(screen.getByRole('tablist', { name: 'Views' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: /Beta/ }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('puts only the open tab in the Tab order when roving, with its id and panel', () => {
    render(
      <PillTabs
        roving
        tabs={TABS.map((t) => ({ ...t, id: `tab-${t.value}`, controls: `panel-${t.value}` }))}
        value="a"
        onChange={() => {}}
      />,
    )
    const alpha = screen.getByRole('tab', { name: 'Alpha' })
    const beta = screen.getByRole('tab', { name: /Beta/ })
    expect(alpha.id).toBe('tab-a')
    expect(alpha.getAttribute('aria-controls')).toBe('panel-a')
    expect(alpha.getAttribute('tabindex')).toBeNull()
    expect(beta.getAttribute('tabindex')).toBe('-1')
  })

  it('draws link tabs as navigation with the current page marked', () => {
    render(
      <PillTabs
        label="Stores"
        value="/platform/stores?state=live"
        tabs={[
          { value: '/platform/stores', label: 'All', href: '/platform/stores' },
          {
            value: '/platform/stores?state=live',
            label: 'Live',
            href: '/platform/stores?state=live',
          },
        ]}
      />,
    )
    expect(screen.getByRole('navigation', { name: 'Stores' })).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByRole('link', { name: 'Live' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'All' }).getAttribute('aria-current')).toBeNull()
  })

  it('shares the width equally when fill is set', () => {
    render(<PillTabs variant="segmented" fill tabs={TABS} value="a" onChange={() => {}} />)
    expect(screen.getByRole('tablist').className).toContain('auto-cols-fr')
  })
})
