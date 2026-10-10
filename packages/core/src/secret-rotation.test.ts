/** SOURCE OF TRUTH: key rotation tests — every stored secret moves to the current key, once */
import { createDb, customer, giftCard, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { phoneBlindIndex } from './customers/phone-crypto'
import { rotateAppSettings, rotateStoreSecrets } from './secret-rotation'
import { decryptSecret, encryptSecret, isUnderCurrentKey, keyId, reencryptSecret } from './secrets'
import { decryptProviderSettings, encryptProviderSettings } from './settings/secrets'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const OLD = 'old-settings-secret-value-1'
const NEW = 'new-settings-secret-value-2'
const keyring = { current: NEW, previous: [OLD] }

/** A `v1` blob (no key id) under `secret`, the format written before key ids existed. */
const legacyBlob = (plain: string, secret: string) =>
  encryptSecret(plain, secret).replace(/^v2\.[0-9a-f]{8}\./, 'v1.')

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

afterEach(() => {
  delete process.env.SETTINGS_SECRET_PREVIOUS
})

async function seedStore() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'rot',
      name: 'Rotation',
      payments: {
        enabled: ['razorpay'],
        providers: {
          razorpay: {
            key_id: 'rzp_live_public',
            key_secret: encryptSecret('rzp-secret', OLD),
            webhook_secret: legacyBlob('hook-secret', OLD),
          },
        },
      },
      shipping: {
        enabled: ['delhivery'],
        providers: { delhivery: { token: encryptSecret('dl-token', NEW) } },
      },
      apps: {
        installed: ['umami'],
        settings: {
          umami: { url: 'https://umami.example', apiKey: encryptSecret('umami-key', OLD) },
        },
      },
    })
    .returning()
  if (!s) throw new Error('seed')
  await owner.insert(giftCard).values({
    storeId: s.id,
    codeHash: 'h1',
    codeCipher: encryptSecret('GIFT-CODE-1', OLD),
    lastCharacters: 'DE-1',
    initialValuePaise: 1000,
    balancePaise: 1000,
  })
  await owner.insert(customer).values({
    storeId: s.id,
    email: 'a@example.com',
    phone: encryptSecret('9876543210', OLD),
    phoneIndex: phoneBlindIndex('9876543210', OLD),
  })
  return s.id
}

describe('keyring helpers', () => {
  it('reencryptSecret leaves a current-key blob alone and moves an old one', () => {
    const current = encryptSecret('x', NEW)
    expect(reencryptSecret(current, keyring)).toBe(current)
    const moved = reencryptSecret(encryptSecret('x', OLD), keyring)
    expect(isUnderCurrentKey(moved, NEW)).toBe(true)
    expect(decryptSecret(moved, NEW)).toBe('x')
  })

  it('decryptSecret falls back to SETTINGS_SECRET_PREVIOUS from the environment', () => {
    const blob = encryptSecret('from-env', OLD)
    expect(() => decryptSecret(blob, NEW)).toThrow()
    process.env.SETTINGS_SECRET_PREVIOUS = ` ${OLD} `
    expect(decryptSecret(blob, NEW)).toBe('from-env')
    expect(decryptSecret(legacyBlob('legacy', OLD), NEW)).toBe('legacy')
  })

  it('saving a settings blob re-encrypts untouched old-key secrets (lazy rotation)', () => {
    const saved = encryptProviderSettings(
      {
        enabled: ['razorpay'],
        providers: {
          razorpay: { key_id: 'pub', key_secret: encryptSecret('s1', OLD), fresh_secret: 'typed' },
        },
      },
      NEW,
      undefined,
      [OLD],
    )
    const cfg = saved.providers.razorpay ?? {}
    expect(cfg.key_id).toBe('pub')
    expect(isUnderCurrentKey(cfg.key_secret ?? '', NEW)).toBe(true)
    expect(isUnderCurrentKey(cfg.fresh_secret ?? '', NEW)).toBe(true)
    expect(decryptProviderSettings(saved, NEW).providers.razorpay).toEqual({
      key_id: 'pub',
      key_secret: 's1',
      fresh_secret: 'typed',
    })
  })

  it('a secret no key opens is kept as it is on save, not dropped', () => {
    const lost = encryptSecret('lost', 'a-key-nobody-has-any-more')
    const saved = encryptProviderSettings(
      { enabled: [], providers: { x: { api_token: lost } } },
      NEW,
      undefined,
      [OLD],
    )
    expect(saved.providers.x?.api_token).toBe(lost)
  })
})

describe('rotateAppSettings', () => {
  it('moves encrypted values at any depth and leaves everything else as it is', () => {
    const apps = {
      installed: ['umami', 'x'],
      settings: {
        umami: { url: 'https://u.example', apiKey: encryptSecret('k', OLD), waitForConsent: true },
        x: { tokens: [legacyBlob('t', OLD), encryptSecret('fresh', NEW)], note: 'v3. not a blob' },
      },
    }
    const r = rotateAppSettings(apps, keyring)
    expect(r.moved).toBe(2)
    expect(r.unreadable).toBe(0)
    const next = r.next as typeof apps
    expect(next.installed).toEqual(['umami', 'x'])
    expect(next.settings.umami.url).toBe('https://u.example')
    expect(next.settings.umami.waitForConsent).toBe(true)
    expect(decryptSecret(next.settings.umami.apiKey, NEW, [])).toBe('k')
    expect(decryptSecret(next.settings.x.tokens[0] ?? '', NEW, [])).toBe('t')
    expect(next.settings.x.tokens[1]).toBe(apps.settings.x.tokens[1])
    expect(next.settings.x.note).toBe('v3. not a blob')
  })

  it('returns the same object when nothing moves, and counts what no key opens', () => {
    const apps = { installed: [], settings: { a: { key: encryptSecret('k', NEW) } } }
    expect(rotateAppSettings(apps, keyring)).toEqual({ next: apps, moved: 0, unreadable: 0 })
    const lost = { settings: { a: { key: encryptSecret('k', 'nobody-has-this-key-1') } } }
    expect(rotateAppSettings(lost, keyring)).toMatchObject({ moved: 0, unreadable: 1 })
    expect(rotateAppSettings(null, keyring)).toEqual({ next: null, moved: 0, unreadable: 0 })
  })
})

describe('rotateStoreSecrets', () => {
  it('dry run counts without writing; apply moves everything; a second run finds nothing', async () => {
    const storeId = await seedStore()

    const dry = await withStore(app, storeId, (tx) =>
      rotateStoreSecrets(tx, storeId, keyring, { apply: false }),
    )
    expect(dry).toEqual({
      settings: 2,
      appSettings: 1,
      columns: { 'gift card codes': 1 },
      phones: 1,
      unreadable: 0,
    })
    const [untouched] = await owner.select().from(store).where(eq(store.id, storeId))
    const untouchedPayments = untouched?.payments as
      | { providers: Record<string, Record<string, string>> }
      | undefined
    const rz = untouchedPayments?.providers.razorpay
    expect(rz?.key_secret?.startsWith(`v2.${keyId(OLD)}.`)).toBe(true)

    const applied = await withStore(app, storeId, (tx) =>
      rotateStoreSecrets(tx, storeId, keyring, { apply: true }),
    )
    expect(applied).toEqual(dry)

    const [after] = await owner.select().from(store).where(eq(store.id, storeId))
    const payments = after?.payments as { providers: Record<string, Record<string, string>> }
    const cfg = payments.providers.razorpay ?? {}
    expect(cfg.key_id).toBe('rzp_live_public')
    expect(isUnderCurrentKey(cfg.key_secret ?? '', NEW)).toBe(true)
    expect(isUnderCurrentKey(cfg.webhook_secret ?? '', NEW)).toBe(true)
    // Decrypts with the new key alone: the old one can now be retired.
    expect(decryptSecret(cfg.key_secret ?? '', NEW, [])).toBe('rzp-secret')
    expect(decryptSecret(cfg.webhook_secret ?? '', NEW, [])).toBe('hook-secret')

    const apps = after?.apps as { installed: string[]; settings: { umami: Record<string, string> } }
    expect(apps.installed).toEqual(['umami'])
    expect(apps.settings.umami.url).toBe('https://umami.example')
    expect(decryptSecret(apps.settings.umami.apiKey ?? '', NEW, [])).toBe('umami-key')

    const [card] = await owner.select().from(giftCard).where(eq(giftCard.storeId, storeId))
    expect(decryptSecret(card?.codeCipher ?? '', NEW, [])).toBe('GIFT-CODE-1')

    const [c] = await owner.select().from(customer).where(eq(customer.storeId, storeId))
    expect(decryptSecret(c?.phone ?? '', NEW, [])).toBe('9876543210')
    // The blind index is keyed by the secret too, so lookups under the new key find it.
    expect(c?.phoneIndex).toBe(phoneBlindIndex('9876543210', NEW))

    const again = await withStore(app, storeId, (tx) =>
      rotateStoreSecrets(tx, storeId, keyring, { apply: true }),
    )
    expect(again).toEqual({
      settings: 0,
      appSettings: 0,
      columns: { 'gift card codes': 0 },
      phones: 0,
      unreadable: 0,
    })
  })

  it('reports blobs no key opens and leaves them in place', async () => {
    const storeId = await seedStore()
    const stranger = encryptSecret('?', 'unknown-key-value-123456')
    await owner.update(giftCard).set({ codeCipher: stranger }).where(eq(giftCard.storeId, storeId))
    const counts = await withStore(app, storeId, (tx) =>
      rotateStoreSecrets(tx, storeId, keyring, { apply: true }),
    )
    expect(counts.unreadable).toBe(1)
    expect(counts.columns['gift card codes']).toBe(0)
    const [card] = await owner.select().from(giftCard).where(eq(giftCard.storeId, storeId))
    expect(card?.codeCipher).toBe(stranger)
  })

  it('extra plugin columns are rotated too, and only for this store (RLS)', async () => {
    const storeId = await seedStore()
    const [other] = await owner.insert(store).values({ slug: 'other', name: 'Other' }).returning()
    if (!other) throw new Error('seed')
    await owner.insert(giftCard).values({
      storeId: other.id,
      codeHash: 'h2',
      codeCipher: encryptSecret('OTHER', OLD),
      lastCharacters: 'HER',
      initialValuePaise: 1,
      balancePaise: 1,
    })
    await owner
      .update(giftCard)
      .set({ note: encryptSecret('note', OLD) })
      .where(eq(giftCard.storeId, storeId))
    const counts = await withStore(app, storeId, (tx) =>
      rotateStoreSecrets(tx, storeId, keyring, {
        apply: true,
        columns: [{ label: 'notes', table: 'gift_card', column: 'note' }],
      }),
    )
    expect(counts.columns.notes).toBe(1)
    const [card] = await owner.select().from(giftCard).where(eq(giftCard.storeId, storeId))
    expect(decryptSecret(card?.note ?? '', NEW, [])).toBe('note')
    const [otherCard] = await owner.select().from(giftCard).where(eq(giftCard.storeId, other.id))
    expect(otherCard?.codeCipher?.startsWith(`v2.${keyId(OLD)}.`)).toBe(true)
  })
})
