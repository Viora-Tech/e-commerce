/** Store settings › policies and extra field definitions: Shopify's against this store's. Pure. */
import { type MetafieldOwnerType, POLICY_TITLES, type PolicyType } from '@commerce/core'
import { PRIVATE_METAFIELD_OWNERS } from '@commerce/core/metaobjects'
import type { FieldOwner, NOwnerDefinition, NPolicy } from './api-settings'
import { planField } from './field-plans'
import { localKey } from './field-values'
import { htmlToRichText, type RichText } from './html'
import type { SettingsItem } from './settings-client'
import {
  type LocalSettings,
  type PartPlan,
  SETTINGS_MAPPINGS,
  type SettingsOp,
} from './settings-plan'

/* ------------------------------------------------------------------ policies */

const POLICY_TYPES_BY_SHOPIFY: Record<string, PolicyType> = {
  REFUND_POLICY: 'refund-policy',
  PRIVACY_POLICY: 'privacy-policy',
  TERMS_OF_SERVICE: 'terms-of-service',
  SHIPPING_POLICY: 'shipping-policy',
  CONTACT_INFORMATION: 'contact-information',
}

type Node = { type: string; children?: Node[] }

/** The document without its pictures: they would still point at Shopify's servers. */
function withoutImages(doc: RichText): RichText | null {
  const keep = (n: Node): boolean =>
    n.type !== 'image' &&
    !(n.type === 'paragraph' && n.children?.length && n.children.every((c) => c.type === 'image'))
  const walk = (n: Node): Node =>
    n.children ? { ...n, children: n.children.filter(keep).map(walk) } : n
  const root = walk(doc.root as Node)
  return root.children?.length ? ({ root } as RichText) : null
}

export function planPolicies(source: readonly NPolicy[], local: LocalSettings): PartPlan {
  const items: SettingsItem[] = []
  const ops: SettingsOp[] = []
  for (const p of source) {
    if (!p.body.trim()) continue
    const type = POLICY_TYPES_BY_SHOPIFY[p.type]
    if (!type) {
      items.push({
        action: 'manual',
        subject: 'policy',
        name: p.title,
        reason: 'policy_type',
        detail: p.type,
      })
      continue
    }
    // The same sanitiser as imported pages: no scripts, styles, frames or inline CSS survive.
    const converted = htmlToRichText(p.body)
    const body = converted.doc ? withoutImages(converted.doc) : null
    if (!body) continue
    const title = p.title.slice(0, 200) || POLICY_TITLES[type]
    if (converted.images.length) {
      items.push({
        action: 'warn',
        subject: 'policy',
        name: title,
        reason: 'policy_images',
        detail: String(converted.images.length),
      })
    }
    const here = local.policies.find((x) => x.type === type)
    if (
      here?.exists &&
      here.title === title &&
      JSON.stringify(here.body) === JSON.stringify(body)
    ) {
      items.push({ action: 'same', subject: 'policy', name: title })
      continue
    }
    items.push({
      action: here?.exists ? 'update' : 'create',
      subject: 'policy',
      name: title,
      from: here?.exists ? here.title : null,
    })
    // A policy already here keeps its published state; a new one goes live like it was on Shopify.
    ops.push({ kind: 'policy', type, title, body, published: here?.exists ? here.published : true })
  }
  return { items, ops }
}

/* -------------------------------------------------------------- extra fields */

/** Already imported as each product's or collection's SEO title and description. */
const SKIP_FIELDS = new Set(['global.title_tag', 'global.description_tag'])

export function planFields(
  source: readonly { owner: FieldOwner; definitions: readonly NOwnerDefinition[] }[],
  local: LocalSettings,
): PartPlan {
  const items: SettingsItem[] = []
  const ops: SettingsOp[] = []
  for (const { owner, definitions } of source) {
    const planned = new Set<string>()
    for (const def of definitions) {
      const nsKey = `${def.namespace}.${def.key}`
      if (SKIP_FIELDS.has(nsKey)) continue
      const base = { subject: 'field' as const, name: def.name, owner: owner.ours }
      const key = localKey(def.key)
      const namespace = localKey(def.namespace)
      const plan = planField(def, key, local.mapped.contentTypes, true)
      if (plan.status !== 'ok') {
        const reason = plan.status === 'unsupported' ? plan.reason : 'reference_target'
        const detail = plan.status === 'unsupported' ? plan.detail : def.type
        items.push({ ...base, action: 'manual', reason, detail })
        continue
      }
      const sourceId = `${owner.shopify}:${nsKey}`
      const mappedId = local.mapped.fields.get(sourceId)
      const existing =
        local.fields.find((f) => f.id === mappedId) ??
        local.fields.find(
          (f) => f.ownerType === owner.ours && f.namespace === namespace && f.key === key,
        )
      const slot = `${namespace}.${key}`
      if (existing) {
        if (existing.type === plan.field.type && existing.list === plan.field.list) {
          items.push({ ...base, action: 'same' })
          if (!mappedId) {
            ops.push({
              kind: 'map',
              resource: SETTINGS_MAPPINGS.fields,
              sourceId,
              localId: existing.id,
            })
          }
        } else {
          items.push({
            ...base,
            action: 'conflict',
            reason: 'field_exists',
            from: existing.type,
            to: plan.field.type,
          })
        }
        continue
      }
      if (planned.has(slot)) {
        items.push({ ...base, action: 'conflict', reason: 'field_exists', to: plan.field.type })
        continue
      }
      planned.add(slot)
      items.push({ ...base, action: 'create', to: plan.field.type })
      ops.push({
        kind: 'field',
        sourceId,
        write: {
          ownerType: owner.ours as MetafieldOwnerType,
          name: plan.field.name,
          namespace,
          key,
          description: plan.field.description ?? null,
          type: plan.field.type,
          list: plan.field.list,
          validations: plan.field.validations ?? {},
          storefrontAccess: !PRIVATE_METAFIELD_OWNERS.includes(owner.ours),
        },
      })
    }
  }
  return { items, ops }
}
