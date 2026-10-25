// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import { routes } from '@/lib/routes'
import PageSettingsPanel from './page-settings-panel'

const copy = customizeContent.pageSettings

vi.mock('./home-page-settings', () => ({ default: () => <p>home form</p> }))
vi.mock('./store-settings-panel', () => ({ default: () => null }))

const draw = (props: Partial<ComponentProps<typeof PageSettingsPanel>>) =>
  render(
    <PageSettingsPanel
      template="home"
      templateLabel="Home page"
      domain="waimers.in"
      resource={null}
      onOpenTheme={() => {}}
      {...props}
    />,
  )

describe('PageSettingsPanel', () => {
  it('gives the home page its own form', () => {
    draw({})
    expect(screen.getByText('home form')).toBeTruthy()
  })

  it('points a product template at the product on the canvas and at all products', () => {
    draw({
      template: 'product',
      resource: { kind: 'product', id: 'p1', title: 'Void Black Mousepad' },
    })
    expect(screen.getByText(copy.previewing('Void Black Mousepad'))).toBeTruthy()
    const edit = screen.getByRole('link', { name: copy.editResource('Void Black Mousepad') })
    expect(edit.getAttribute('href')).toBe(routes.products.detail('p1'))
    const all = screen.getByRole('link', { name: copy.allResources(copy.resource.product) })
    expect(all.getAttribute('href')).toBe(routes.products.list())
  })

  it('lists blog posts for the blog post template, with nothing previewed', () => {
    draw({ template: 'article' })
    expect(screen.getByText(copy.resourceBody(copy.resource.article))).toBeTruthy()
    expect(screen.queryByRole('link', { name: /^Edit/ })).toBeNull()
  })

  it('says the cart has no settings of its own', () => {
    draw({ template: 'cart' })
    expect(screen.getByText(copy.fixedBody)).toBeTruthy()
  })
})
