/** SOURCE OF TRUTH: merchant store creation — WHAT createStore makes for a new merchant (organization, store, domains, owner, theme, shipping, onboarding defaults) / WHY one resumable, idempotent path any signed-in merchant can call */
import { createHash } from 'node:crypto'
import {
  collection,
  type Db,
  isUniqueViolation,
  type StoreTx,
  seedWaimersShipping,
  store,
  storeDomain,
  withStore,
} from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { installApp, parseAppsSettings } from '../apps/settings'
import { PREINSTALLED_APPS } from '../automations/app'
import { createCollection } from '../collections/service'
import { requestDomainRoute } from '../domains/routes'
import { CommerceError } from '../errors'
import { ensurePrimaryMarket } from '../markets/service'
import { listRoles, seedSystemRoles, upsertMember } from '../permissions/service'
import { emptyStoreAddress, StoreAddressSchema } from '../settings/general'
import { ensureMainTheme } from '../theme/library'
import { type BusinessProfile, starterCollections } from './business-profile'
import { SLUG_MAX, SLUG_MIN, slugFormatProblem } from './slug'

export type OnboardingErrorCode = 'SLUG_INVALID' | 'SLUG_RESERVED' | 'SLUG_TAKEN'

export class OnboardingError extends CommerceError {
  declare readonly code: OnboardingErrorCode
  constructor(code: OnboardingErrorCode, message: string) {
    super(code, message)
  }
}

export type CreateStoreInput = {
  db: Db
  /** The signed-in user who will own the store. */
  ownerUserId: string
  name: string
  slug: string
  /** e.g. "waimers.store" - `<slug>.<platformDomain>` becomes the primary domain. */
  platformDomain: string
  /**
   * True when Dokploy manages the proxy: the new `<slug>.<platformDomain>` is queued for an
   * HTTPS route (worker job, retried; store creation never waits on Dokploy).
   */
  requestPlatformRoute?: boolean
  /** Adds `<slug>.localhost` too, for local development. */
  addLocalhostDomain?: boolean
  /**
   * Creates the Better Auth organization for this store and returns its id.
   * Injected so this module stays free of `@commerce/auth` - the caller has
   * the session and headers Better Auth's API needs.
   * See `packages/api/src/routers/onboarding.ts`.
   */
  createOrganization: (input: { name: string; slug: string }) => Promise<{ organizationId: string }>
  /** Answers from the guided flow: starter collections, the address's state and country. */
  profile?: BusinessProfile | undefined
  /** Plugin ids to install on the new store (e.g. the Shopify importer for a store moving from Shopify). */
  installApps?: string[]
}

export type CreateStoreResult = {
  storeId: string
  organizationId: string
  slug: string
  /** False when this call found a store already made (double-submit) instead of making one. */
  created: boolean
}

/**
 * A store's id is derived from who is creating it and the slug they picked,
 * not randomised, so that retrying the exact same request (a double-submit,
 * or a client retry after a timeout) always lands on the same row instead of
 * racing to insert a second one. `store` is RLS-scoped by its own `id`
 * (`store_isolation` in `0001_rls.sql`), so this also tells us which
 * transaction-scoped `app.store_id` to open before the row exists.
 */
function deterministicStoreId(ownerUserId: string, slug: string): string {
  const hex = createHash('sha256').update(`store:${ownerUserId}:${slug}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

async function findOwnRow(db: Db, storeId: string) {
  const [row] = await withStore(db, storeId, (tx) =>
    tx.select().from(store).where(eq(store.id, storeId)),
  )
  return row ?? null
}

/**
 * Saves the onboarding answers and seeds what they imply. Safe to repeat: the
 * address is only filled when still empty, and a starter collection is only
 * made when no collection with that title exists yet.
 */
async function applyBusinessProfile(
  tx: StoreTx,
  storeId: string,
  profile: BusinessProfile,
): Promise<void> {
  const [row] = await tx.select({ address: store.address }).from(store).where(eq(store.id, storeId))
  const address = row?.address
    ? undefined
    : StoreAddressSchema.parse({
        ...emptyStoreAddress,
        state: profile.state,
        country: profile.country,
      })
  await tx
    .update(store)
    .set({
      businessProfile: { sells: profile.sells, sellsOn: profile.sellsOn },
      ...(address ? { address } : {}),
    })
    .where(eq(store.id, storeId))

  const existing = new Set(
    (await tx.select({ title: collection.title }).from(collection)).map((c) => c.title),
  )
  for (const starter of starterCollections(profile.sells)) {
    if (existing.has(starter.title)) continue
    await createCollection(tx, storeId, {
      title: starter.title,
      kind: 'automatic',
      rules: { match: 'all', conditions: [{ field: 'tag', op: 'eq', value: starter.tag }] },
    })
  }
}

async function installStoreApps(tx: StoreTx, storeId: string, ids: string[]): Promise<void> {
  const [row] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = ids.reduce(installApp, parseAppsSettings(row?.apps))
  await tx.update(store).set({ apps }).where(eq(store.id, storeId))
}

/**
 * Creates a store for a signed-in merchant: organization, owner member,
 * store row, primary domain, and the defaults that already have builders
 * (the main theme, the primary market, a shipping zone). Mirrors what `packages/db/src/seed.ts`
 * does for the Waimers dev seed, but as a service any merchant can call.
 *
 * Resumable rather than one big transaction (the organization lives in
 * Better Auth's own tables, outside this database's control): every step
 * either checks first or is itself idempotent, so calling this again with
 * the same owner and slug picks up wherever the previous call stopped.
 */
export async function createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
  const problem = slugFormatProblem(input.slug)
  if (problem === 'too_short' || problem === 'too_long' || problem === 'invalid_chars') {
    throw new OnboardingError(
      'SLUG_INVALID',
      `Store address should be ${SLUG_MIN}-${SLUG_MAX} lower-case letters, numbers or hyphens`,
    )
  }
  if (problem === 'reserved') {
    throw new OnboardingError('SLUG_RESERVED', 'That store address is reserved')
  }

  const { db } = input
  const name = input.name.trim()
  if (!name) throw new OnboardingError('SLUG_INVALID', 'Store name is required')

  const storeId = deterministicStoreId(input.ownerUserId, input.slug)
  let storeRow = await findOwnRow(db, storeId)
  const created = !storeRow

  if (!storeRow) {
    try {
      const [inserted] = await withStore(db, storeId, (tx) =>
        tx.insert(store).values({ id: storeId, slug: input.slug, name }).returning(),
      )
      storeRow = inserted ?? null
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      // Either our own retry racing itself (the row exists now - use it), or
      // someone else already holds this slug (still nothing - not ours).
      storeRow = await findOwnRow(db, storeId)
      if (!storeRow) {
        throw new OnboardingError('SLUG_TAKEN', 'That store address is already taken')
      }
    }
  }
  if (!storeRow) throw new Error('store row missing after insert')

  const domains = [
    { storeId, hostname: `${input.slug}.${input.platformDomain}`, isPrimary: true },
    ...(input.addLocalhostDomain ? [{ storeId, hostname: `${input.slug}.localhost` }] : []),
  ]
  await withStore(db, storeId, async (tx) => {
    for (const domain of domains) {
      // A failed insert would abort the rest of this transaction (Postgres,
      // not just this statement), so check first rather than catch after.
      const already = await tx
        .select({ id: storeDomain.id })
        .from(storeDomain)
        .where(eq(storeDomain.hostname, domain.hostname))
      if (already.length === 0) await tx.insert(storeDomain).values(domain)
    }
    if (input.requestPlatformRoute) {
      // Only a row nobody asked for yet, so a retried createStore queues it once.
      const [row] = await tx
        .select({ id: storeDomain.id })
        .from(storeDomain)
        .where(
          and(
            eq(storeDomain.storeId, storeId),
            eq(storeDomain.hostname, domains[0]?.hostname ?? ''),
            eq(storeDomain.routeStatus, 'none'),
          ),
        )
      if (row) {
        await tx.update(storeDomain).set({ sslStatus: 'issuing' }).where(eq(storeDomain.id, row.id))
        await requestDomainRoute(tx, storeId, row.id, new Date())
      }
    }
  })

  let organizationId = storeRow.organizationId
  if (!organizationId) {
    const orgResult = await input
      .createOrganization({ name, slug: input.slug })
      .catch(async (err: unknown) => {
        // Refused (e.g. Better Auth's organization limit): give the address back, or an
        // owner over their limit could hold any number of store addresses with no store
        // behind them (security audit 2026-09-28 branch, ported 2026-10-06).
        if (created) {
          await withStore(db, storeId, async (tx) => {
            await tx.delete(storeDomain).where(eq(storeDomain.storeId, storeId))
            await tx.delete(store).where(eq(store.id, storeId))
          })
        }
        throw err
      })
    organizationId = orgResult.organizationId
    await withStore(db, storeId, (tx) =>
      tx.update(store).set({ organizationId }).where(eq(store.id, storeId)),
    )
  }

  await withStore(db, storeId, async (tx) => {
    await seedSystemRoles(tx, storeId)
    const roles = await listRoles(tx, storeId)
    const ownerRoleId = roles.find((r) => r.slug === 'owner')?.id
    if (!ownerRoleId) throw new Error('owner role was not seeded')
    await upsertMember(tx, {
      storeId,
      userId: input.ownerUserId,
      roleId: ownerRoleId,
      status: 'active',
    })
    // A new merchant starts on the neutral Minimal look, never the Waimers one.
    await ensureMainTheme(tx, storeId, 'minimal')
    // India in rupees: the market the storefront serves when no other one matches.
    await ensurePrimaryMarket(tx, storeId)
    await seedWaimersShipping(tx, storeId)
    if (input.profile) await applyBusinessProfile(tx, storeId, input.profile)
    // Built-in apps every store starts with (Automations, like Shopify Flow), then any asked for.
    await installStoreApps(tx, storeId, [...PREINSTALLED_APPS, ...(input.installApps ?? [])])
  })

  return { storeId, organizationId, slug: storeRow.slug, created }
}
