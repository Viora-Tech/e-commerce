import { describe, expect, it } from 'vitest'
import type { AppSummary } from '@/lib/app-summary'
import { appEntryHref, matchesQuery } from './apps-gallery'

const base: Omit<AppSummary, 'id' | 'name' | 'kind' | 'category' | 'company'> = {
  version: '1.0.0',
  description: null,
  builtIn: false,
  billing: { state: 'free' },
  installed: false,
  connected: false,
  provides: { payments: [], shipping: [], notifications: [], storage: [] },
  admin: { icon: null, pages: [] },
  hooks: [],
  productFields: [],
  credits: [],
  access: { resources: [], summary: null, shares: [] },
  status: null,
  problem: null,
  installedAt: null,
  installedBy: null,
  lastActivity: null,
  lastActivityAt: null,
  connectsIn: null,
  canDisconnect: false,
}

const app = (
  patch: Partial<AppSummary> & Pick<AppSummary, 'id' | 'name' | 'kind'>,
): AppSummary => ({
  ...base,
  category: null,
  company: null,
  ...patch,
})

describe('matchesQuery', () => {
  const delhivery = app({
    id: 'delhivery',
    name: 'Delhivery',
    kind: 'connection',
    description: 'Serviceability and tracking',
  })

  it('matches by name or description, case-insensitively', () => {
    expect(matchesQuery(delhivery, 'DELHI')).toBe(true)
    expect(matchesQuery(delhivery, 'tracking')).toBe(true)
    expect(matchesQuery(delhivery, 'nope')).toBe(false)
    expect(matchesQuery(delhivery, '')).toBe(true)
  })
})

describe('appEntryHref', () => {
  const provides = { payments: [], shipping: [], notifications: [], storage: [] }

  it('opens the app itself when it has pages', () => {
    expect(appEntryHref({ id: 'shopify-import', provides, admin: { pages: [{}] } })).toBe(
      '/apps/shopify-import',
    )
  })

  it('opens the settings page of the kind an app without pages provides', () => {
    expect(
      appEntryHref({
        id: 'r2',
        provides: { ...provides, storage: [{ id: 'r2', label: 'R2' }] },
        admin: { pages: [] },
      }),
    ).toBe('/content/files/storage')
  })
})
