import { describe, expect, it } from 'vitest'
import type { AppSummary } from '@/components/apps/app-card'
import { recommendedApps } from './apps-recommended'

const app = (id: string, patch: Partial<AppSummary> = {}): AppSummary => ({
  id,
  name: id,
  kind: 'builtin',
  version: '1.0.0',
  description: null,
  builtIn: false,
  installed: false,
  connected: false,
  category: null,
  company: null,
  provides: { payments: [], shipping: [], notifications: [], storage: [] },
  admin: { icon: null, pages: [] },
  hooks: [],
  productFields: [],
  credits: [],
  ...patch,
})

const catalogue = (installed: string[] = []) =>
  ['delhivery', 'shiprocket', 'reviews', 'whatsapp', 'gst-invoices', 'razorpay'].map((id) =>
    app(id, { installed: installed.includes(id) }),
  )

describe('recommendedApps', () => {
  it('suggests Delhivery for a store with no courier, then Reviews and WhatsApp', () => {
    expect(recommendedApps(catalogue()).map((a) => a.id)).toEqual([
      'delhivery',
      'reviews',
      'whatsapp',
    ])
  })

  it('skips a gap that is covered by an installed app, and never suggests an installed one', () => {
    const ids = recommendedApps(catalogue(['shiprocket', 'reviews'])).map((a) => a.id)
    expect(ids).toEqual(['whatsapp', 'gst-invoices', 'razorpay'])
  })

  it('counts any app that provides the kind as covering it', () => {
    const apps = [
      app('some-courier', {
        installed: true,
        provides: {
          payments: [],
          shipping: [{ id: 'x', label: 'X' }],
          notifications: [],
          storage: [],
        },
      }),
      ...catalogue(),
    ]
    expect(recommendedApps(apps).map((a) => a.id)).not.toContain('delhivery')
  })

  it('returns nothing when every gap is covered', () => {
    expect(
      recommendedApps(catalogue(['delhivery', 'reviews', 'whatsapp', 'gst-invoices', 'razorpay'])),
    ).toEqual([])
  })
})
