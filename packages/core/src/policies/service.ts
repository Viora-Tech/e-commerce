/** SOURCE OF TRUTH: store policy pages — WHAT: read and save the five policy pages (ordinary `page` rows with fixed handles), the legal name and grievance officer on `store.preferences.policies`, the facts templates are filled from, and the published list the storefront links / WHY: Settings → Policies, the storefront footer, checkout and `/policies/<type>`, and the setup checklist all read policies through one module */
import { page, shippingRate, store, storeDomain } from '@commerce/db'
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { parseReturnPolicy } from '../returns/policy'
import { emptyStoreAddress, StoreAddressSchema } from '../settings/general'
import { parseShippingSettings } from '../shipping/settings'
import {
  isPolicyType,
  POLICY_TITLES,
  POLICY_TYPES,
  type PolicyLink,
  type PolicySettings,
  PolicySettingsSchema,
  type PolicyType,
  parsePolicySettings,
  policyHandle,
  policyPath,
  transitRange,
} from './client'
import {
  fillPolicyTemplate,
  type MissingDetail,
  missingTemplateDetails,
  type PolicyRichText,
  type PolicyTemplateInput,
} from './templates'

/** Same empty Puck layout new pages get; `page.data` is a legacy, required column. */
const EMPTY_LAYOUT = { root: { props: {} }, content: [], zones: {} }

export type StorePolicy = {
  type: PolicyType
  title: string
  /** Null until the policy is created. */
  pageId: string | null
  published: boolean
  body: unknown
  updatedAt: Date | null
}

const HANDLES = POLICY_TYPES.map(policyHandle)

async function policyRows(ctx: StoreContext) {
  return ctx.tx
    .select({
      id: page.id,
      handle: page.handle,
      title: page.title,
      body: page.body,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
    })
    .from(page)
    .where(and(eq(page.storeId, ctx.storeId), inArray(page.handle, HANDLES)))
}

/** All five policies, created or not, in Settings order. */
export async function listPolicies(ctx: StoreContext): Promise<StorePolicy[]> {
  const rows = await policyRows(ctx)
  return POLICY_TYPES.map((type) => {
    const row = rows.find((r) => r.handle === policyHandle(type))
    return {
      type,
      title: row?.title ?? POLICY_TITLES[type],
      pageId: row?.id ?? null,
      published: row?.publishedAt != null,
      body: row?.body ?? null,
      updatedAt: row?.updatedAt ?? null,
    }
  })
}

export type SavePolicyInput = {
  type: PolicyType
  title: string
  body: unknown
  published: boolean
}

/** Create or update a policy's page. Publishing keeps the first publish date. */
export async function savePolicy(ctx: StoreContext, input: SavePolicyInput): Promise<StorePolicy> {
  if (!isPolicyType(input.type)) throw new Error(`Unknown policy ${String(input.type)}`)
  const handle = policyHandle(input.type)
  const title = input.title.trim() || POLICY_TITLES[input.type]
  const now = new Date()
  const [row] = await ctx.tx
    .insert(page)
    .values({
      storeId: ctx.storeId,
      handle,
      title,
      body: input.body,
      data: EMPTY_LAYOUT,
      publishedAt: input.published ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [page.storeId, page.handle],
      set: {
        title,
        body: input.body,
        updatedAt: now,
        publishedAt: input.published
          ? sql`coalesce(${page.publishedAt}, ${now.toISOString()}::timestamptz)`
          : null,
      },
    })
    .returning()
  if (!row) throw new Error('policy page upsert returned nothing')
  return {
    type: input.type,
    title: row.title,
    pageId: row.id,
    published: row.publishedAt != null,
    body: row.body,
    updatedAt: row.updatedAt,
  }
}

export async function loadPolicySettings(ctx: StoreContext): Promise<PolicySettings> {
  const [s] = await ctx.tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parsePolicySettings(s?.preferences)
}

/**
 * Save the legal name and grievance officer into `store.preferences.policies`,
 * leaving every other preference (SEO, password, privacy banner, checkout) alone.
 */
export async function savePolicySettings(
  ctx: StoreContext,
  input: unknown,
): Promise<PolicySettings> {
  const policies = PolicySettingsSchema.parse(input)
  await ctx.tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ policies })}::jsonb`,
    })
    .where(eq(store.id, ctx.storeId))
  return policies
}

/** Everything a template is filled from: store details, returns settings and shipping rates. */
async function policyTemplateInput(ctx: StoreContext): Promise<PolicyTemplateInput> {
  const [s] = await ctx.tx
    .select({
      name: store.name,
      contactEmail: store.contactEmail,
      contactPhone: store.contactPhone,
      address: store.address,
      gstin: store.gstin,
      preferences: store.preferences,
      returns: store.returns,
      shipping: store.shipping,
    })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  if (!s) throw new Error(`store ${ctx.storeId} not visible in context`)
  const rates = await ctx.tx
    .select({
      min: shippingRate.minTransitDays,
      max: shippingRate.maxTransitDays,
      freeAbove: shippingRate.freeAbovePaise,
    })
    .from(shippingRate)
    .where(eq(shippingRate.storeId, ctx.storeId))
  const [domain] = await ctx.tx
    .select({ hostname: storeDomain.hostname })
    .from(storeDomain)
    .where(
      and(
        eq(storeDomain.storeId, ctx.storeId),
        eq(storeDomain.isPrimary, true),
        eq(storeDomain.status, 'active'),
      ),
    )
  const address = StoreAddressSchema.safeParse(s.address ?? {})
  const returns = parseReturnPolicy(s.returns)
  const policy = parseShippingSettings(s.shipping).policy
  const settings = parsePolicySettings(s.preferences)
  return {
    storeName: s.name,
    legalName: settings.legalName,
    address: address.success ? address.data : emptyStoreAddress,
    email: s.contactEmail ?? '',
    phone: s.contactPhone ?? '',
    gstin: s.gstin ?? '',
    website: domain?.hostname ?? '',
    returns: {
      enabled: returns.enabled,
      windowDays: returns.windowDays,
      refundMethod: returns.refundMethod,
    },
    shipping: {
      ...transitRange(rates, policy.defaultMinTransitDays, policy.defaultMaxTransitDays),
      codAllowed: policy.codAllowed,
      freeAbovePaise: lowest(rates.map((r) => r.freeAbove)),
    },
    grievanceOfficer: settings.grievanceOfficer,
  }
}

function lowest(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null && v > 0)
  return present.length > 0 ? Math.min(...present) : null
}

export type PolicyDraft = { body: PolicyRichText; missing: MissingDetail[] }

/** A policy's template, filled from the store as it is now. Nothing is saved. */
export async function policyFromTemplate(
  ctx: StoreContext,
  type: PolicyType,
): Promise<PolicyDraft> {
  const input = await policyTemplateInput(ctx)
  return { body: fillPolicyTemplate(type, input), missing: missingTemplateDetails(input) }
}

/** Published policies, in footer order. */
export async function publishedPolicyLinks(ctx: StoreContext): Promise<PolicyLink[]> {
  const rows = await ctx.tx
    .select({ handle: page.handle, title: page.title })
    .from(page)
    .where(
      and(
        eq(page.storeId, ctx.storeId),
        inArray(page.handle, HANDLES),
        isNotNull(page.publishedAt),
      ),
    )
  return POLICY_TYPES.flatMap((type) => {
    const row = rows.find((r) => r.handle === policyHandle(type))
    return row ? [{ type, title: row.title, href: policyPath(type) }] : []
  })
}

/** One published policy for `/policies/<type>`; null when it is missing or hidden. */
export async function publishedPolicy(ctx: StoreContext, type: PolicyType) {
  const [row] = await ctx.tx
    .select({
      title: page.title,
      body: page.body,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
    })
    .from(page)
    .where(and(eq(page.storeId, ctx.storeId), eq(page.handle, policyHandle(type))))
  return row ?? null
}
