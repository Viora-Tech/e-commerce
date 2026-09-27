import type { SettingKind, SourceOption, SourceValues } from '@commerce/core/dynamic-sources'
import type { TemplateKey } from '@commerce/core/theme'
import { createContext, useContext } from 'react'
import { dynamicSourcesContent as copy } from '@/data/dynamic-sources'
import { api } from '@/lib/api-client'
import { type FieldLike, isImageField, isLinkField } from './customize-field-shape'
import { isLinkTextField } from './customize-links'

/**
 * Admin side of dynamic sources: which template (and which previewed product or
 * collection) the editor is on, the source catalog per template, and preview
 * values. The binding format and every rule live in `@commerce/core/dynamic-sources`.
 */

export type DynamicSourceScope = {
  template: TemplateKey
  productId: string | null
  collectionId: string | null
}

export const DynamicSourceContext = createContext<DynamicSourceScope | null>(null)

export function useDynamicSourceScope(): DynamicSourceScope | null {
  return useContext(DynamicSourceContext)
}

/** The scope for a template and the resource the preview draws it with. */
export const scopeFor = (
  template: TemplateKey,
  kind: string | null,
  resourceId: string | null,
): DynamicSourceScope => ({
  template,
  productId: kind === 'product' ? resourceId : null,
  collectionId: kind === 'collection' ? resourceId : null,
})

const COLOUR_NAME = /colou?r/i
/** The inside of an image or link object: connected as a whole, never piece by piece. */
const OBJECT_PART = /(^|[.\]])(url|href)$/

/**
 * What kind of setting a Puck field is, for the connect button; null when it
 * cannot be connected (choices, toggles, lists, groups). Colours are text
 * fields named after a colour, as the section settings define them; link text
 * fields (the link picker) are plain `url` settings.
 */
export function settingKindOf(field: FieldLike, name: string): SettingKind | null {
  switch (field.type) {
    case 'text':
      if (isLinkTextField(field, name)) return 'url'
      if (OBJECT_PART.test(name)) return null
      return COLOUR_NAME.test(name) || COLOUR_NAME.test(field.label ?? '') ? 'color' : 'text'
    case 'textarea':
      return 'text'
    case 'number':
      return 'number'
    case 'custom':
      return 'richtext'
    case 'object':
      if (isImageField(field)) return 'image'
      if (isLinkField(field)) return 'link'
      return null
    default:
      return null
  }
}

const catalogs = new Map<string, Promise<SourceOption[]>>()

/** Sources a template can connect to, fetched once per template per editor session. */
export function loadCatalog(template: TemplateKey): Promise<SourceOption[]> {
  let found = catalogs.get(template)
  if (!found) {
    found = api.themes.templates.sources({ template }).catch((err: unknown) => {
      catalogs.delete(template)
      throw err
    })
    catalogs.set(template, found)
  }
  return found
}

const values = new Map<string, Promise<SourceValues>>()

/** Preview values for connected settings, cached per resource and path. */
export async function loadValues(
  paths: readonly string[],
  scope: DynamicSourceScope | null,
): Promise<SourceValues> {
  const key = (path: string) => `${scope?.productId ?? ''}|${scope?.collectionId ?? ''}|${path}`
  const missing = paths.filter((p) => !values.has(key(p)))
  if (missing.length) {
    const batch = api.themes.templates
      .sourceValues({
        paths: missing,
        productId: scope?.productId ?? null,
        collectionId: scope?.collectionId ?? null,
      })
      .catch(() => ({}) as SourceValues)
    for (const p of missing) values.set(key(p), batch)
  }
  const out: SourceValues = {}
  for (const p of paths) {
    const got = (await values.get(key(p)))?.[p]
    if (got) out[p] = got
  }
  return out
}

/** "Product › Title", "FAQ › Shipping › Answer": how a chip names its source. */
export function sourceName(path: string, catalog: readonly SourceOption[] | null): string {
  const option = catalog?.find((o) => o.path === path)
  if (!option) return catalog ? copy.unknown : path
  return copy.chip(optionParts(option))
}

/** Group heading and label of a picker entry. */
export function optionParts(option: SourceOption): string[] {
  const [scope, ...rest] = option.path.split('.')
  const field = rest.join('.')
  switch (option.group) {
    case 'product':
      return [copy.groups.product, copy.product[field as keyof typeof copy.product] ?? field]
    case 'collection':
      return [
        copy.groups.collection,
        copy.collection[field as keyof typeof copy.collection] ?? field,
      ]
    case 'shop':
      return [copy.groups.shop, copy.shop[field as keyof typeof copy.shop] ?? field]
    case 'metaobject':
      return [option.definition ?? scope ?? '', option.entry ?? '', option.label ?? '']
    default:
      return [copy.groups[option.group], option.label ?? field]
  }
}
