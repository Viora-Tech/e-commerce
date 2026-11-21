import { savedTemplateDesign, saveTemplateDesign } from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { defaultEmailDesign, type EmailTemplateDesign } from '@commerce/notifications'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  notificationsOverview,
  previewTemplateDesign,
  templateDesignOverview,
} from '../src/services/notifications.service'

/** Settings → Notifications → Edit design against the test database (RLS on the app role). */
const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

async function makeStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: 'Test shop' }).returning()
  return s?.id as string
}

const custom = (): EmailTemplateDesign => {
  const d = defaultEmailDesign('order_shipped')
  return {
    ...d,
    subject: 'On its way, {{customer_name}}',
    blocks: [{ id: 'h', type: 'heading', text: 'Packed with care', size: 'large' }, ...d.blocks],
  }
}

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('email template designs', () => {
  it('starts with no design, saves one, marks the row and keeps it to its store', async () => {
    const a = await makeStore('design-a')
    const b = await makeStore('design-b')
    const first = await withStore(app, a, (tx) => templateDesignOverview(tx, a, 'order_shipped'))
    expect(first.design).toBeNull()
    expect(first.slots.some((s) => s.locked)).toBe(true)
    expect(first.variables).toContain('tracking_url')

    await withStore(app, a, (tx) =>
      saveTemplateDesign(tx, a, 'order_shipped', custom(), 'x@example.com'),
    )
    const saved = await withStore(app, a, (tx) => savedTemplateDesign(tx, a, 'order_shipped'))
    expect(saved?.subject).toBe('On its way, {{customer_name}}')
    const overview = await withStore(app, a, (tx) => notificationsOverview(tx, a))
    expect(overview.messages.find((m) => m.id === 'order_shipped')?.designed).toBe(true)

    // Another store never sees it.
    expect(await withStore(app, b, (tx) => savedTemplateDesign(tx, b, 'order_shipped'))).toBeNull()
    expect(await withStore(app, b, (tx) => savedTemplateDesign(tx, a, 'order_shipped'))).toBeNull()
  })

  it('previews an unsaved design with the sample order', async () => {
    const a = await makeStore('design-preview')
    const r = await withStore(app, a, (tx) =>
      previewTemplateDesign(tx, a, 'order_shipped', custom()),
    )
    expect(r.html).toContain('Packed with care')
    expect(r.subject).toMatch(/^On its way, /)
  })
})
