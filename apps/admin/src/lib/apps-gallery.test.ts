import { describe, expect, it } from 'vitest'
import type { AppSummary } from '@/components/apps/app-card'
import { categoriesOf, filterConnections, groupApps } from './apps-gallery'

const base: Omit<AppSummary, 'id' | 'name' | 'kind' | 'category' | 'company'> = {
  version: '1.0.0',
  description: null,
  builtIn: false,
  installed: false,
  connected: false,
  provides: { payments: [], shipping: [], notifications: [], storage: [] },
  admin: { icon: null, pages: [] },
  hooks: [],
  productFields: [],
  credits: [],
}

const app = (
  patch: Partial<AppSummary> & Pick<AppSummary, 'id' | 'name' | 'kind'>,
): AppSummary => ({
  ...base,
  category: null,
  company: null,
  ...patch,
})

describe('groupApps', () => {
  it('splits into builtin and connections, dropping the implicit core plugin', () => {
    const apps = [
      app({ id: 'core', name: 'Built-in', kind: 'builtin' }),
      app({ id: 'back-in-stock', name: 'Back in stock', kind: 'builtin' }),
      app({ id: 'r2', name: 'Cloudflare R2', kind: 'connection', company: 'Cloudflare' }),
    ]
    const { builtin, connections } = groupApps(apps)
    expect(builtin.map((a) => a.id)).toEqual(['back-in-stock'])
    expect(connections.map((a) => a.id)).toEqual(['r2'])
  })
})

describe('categoriesOf', () => {
  it('lists each category once, in first-seen order', () => {
    const apps = [
      app({ id: 'r2', name: 'R2', kind: 'connection', category: 'storage' }),
      app({ id: 'razorpay', name: 'Razorpay', kind: 'connection', category: 'payments' }),
      app({ id: 's3', name: 'S3', kind: 'connection', category: 'storage' }),
      app({ id: 'no-cat', name: 'No category', kind: 'connection' }),
    ]
    expect(categoriesOf(apps)).toEqual(['storage', 'payments'])
  })
})

describe('filterConnections', () => {
  const apps = [
    app({
      id: 'r2',
      name: 'Cloudflare R2',
      kind: 'connection',
      category: 'storage',
      installed: true,
    }),
    app({ id: 'razorpay', name: 'Razorpay', kind: 'connection', category: 'payments' }),
    app({
      id: 'delhivery',
      name: 'Delhivery',
      kind: 'connection',
      category: 'shipping',
      description: 'Serviceability and tracking',
    }),
  ]

  it('matches by name or description, case-insensitively', () => {
    expect(filterConnections(apps, 'razor', 'all').map((a) => a.id)).toEqual(['razorpay'])
    expect(filterConnections(apps, 'TRACKING', 'all').map((a) => a.id)).toEqual(['delhivery'])
    expect(filterConnections(apps, 'nope', 'all')).toEqual([])
  })

  it('filters to installed', () => {
    expect(filterConnections(apps, '', 'installed').map((a) => a.id)).toEqual(['r2'])
  })

  it('filters to a category', () => {
    expect(filterConnections(apps, '', 'shipping').map((a) => a.id)).toEqual(['delhivery'])
  })

  it('combines search and filter', () => {
    expect(filterConnections(apps, 'r2', 'installed').map((a) => a.id)).toEqual(['r2'])
    expect(filterConnections(apps, 'razorpay', 'shipping')).toEqual([])
  })
})
