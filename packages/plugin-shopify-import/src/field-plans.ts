/**
 * Turn Shopify field definitions (a content type's fields, or a metafield
 * definition) into ours: key, type, list, the rules we keep, and the content
 * type an entry link points at. Fields we cannot hold are returned with the
 * reason, never dropped quietly.
 */
import type { FieldDefinition, FieldValidations } from '@commerce/core/metaobjects'
import {
  type FieldPlan,
  localKey,
  mapShopifyType,
  referenceTarget,
  validationsFrom,
} from './field-values'
import type { NFieldDefinition } from './types'

export type PlannedField =
  | { status: 'ok'; shopifyKey: string; plan: FieldPlan; field: FieldDefinition }
  /** An entry link whose content type is not imported yet; plan again after it is. */
  | { status: 'waiting'; shopifyKey: string; target: string }
  | {
      status: 'unsupported'
      shopifyKey: string
      reason: 'field_type' | 'reference_target'
      detail: string
    }

const clip = (s: string, max: number) => s.trim().slice(0, max)

/**
 * One Shopify field → ours. `targets` maps Shopify content type ids to ours;
 * on the `final` pass a link to a content type that never arrived is
 * unsupported instead of waiting.
 */
export function planField(
  f: NFieldDefinition,
  key: string,
  targets: ReadonlyMap<string, string>,
  final: boolean,
): PlannedField {
  const mapping = mapShopifyType(f.type)
  if (!mapping.ok) {
    return { status: 'unsupported', shopifyKey: f.key, reason: 'field_type', detail: f.type }
  }
  const validations: FieldValidations = validationsFrom(f, mapping.type)
  if (mapping.type === 'metaobject_reference') {
    const target = referenceTarget(f)
    const local = target ? targets.get(target) : undefined
    if (!local) {
      if (target && !final) return { status: 'waiting', shopifyKey: f.key, target }
      return {
        status: 'unsupported',
        shopifyKey: f.key,
        reason: 'reference_target',
        detail: f.name,
      }
    }
    validations.metaobjectDefinitionId = local
  }
  const name = clip(f.name, 100) || key
  const field: FieldDefinition = {
    key,
    name,
    type: mapping.type,
    list: mapping.list,
    // Shopify's "required" is not copied: a value we had to leave out would block the entry.
    required: false,
    ...(f.description ? { description: clip(f.description, 300) } : {}),
    ...(Object.keys(validations).length ? { validations } : {}),
  }
  return {
    status: 'ok',
    shopifyKey: f.key,
    plan: { localKey: key, mapping, rule: field },
    field,
  }
}

/** Every field of a content type, with keys made unique after converting them to ours. */
export function planFields(
  fields: readonly NFieldDefinition[],
  targets: ReadonlyMap<string, string>,
  final: boolean,
): PlannedField[] {
  const used = new Set<string>()
  return fields.map((f) => {
    const base = localKey(f.key)
    let key = base
    for (let n = 2; used.has(key); n++) key = `${base.slice(0, 60)}_${n}`
    used.add(key)
    return planField(f, key, targets, final)
  })
}
