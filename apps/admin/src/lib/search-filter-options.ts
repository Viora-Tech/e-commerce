/** The Filters page's choices: every filter a store can show, named and described from what its catalogue has. */
import type { FilterSources } from '@commerce/core'
import { type FilterGroupConfig, groupId, tagPrefixLabel } from '@commerce/core/filter-config'
import type { searchFiltersContent } from '@/data/search-filters'

type Copy = typeof searchFiltersContent

/** One filter the merchant can add: the stored group, its name and a line about its values. */
export type FilterChoice = {
  id: string
  group: FilterGroupConfig
  name: string
  detail: string
  kind: 'builtIn' | 'options' | 'metafields' | 'tagGroups'
}

/** Every filter the store's catalogue offers, in the dialog's order. */
export function filterChoices(sources: FilterSources, copy: Copy): FilterChoice[] {
  const out: FilterChoice[] = []
  const add = (
    group: FilterGroupConfig,
    name: string,
    detail: string,
    kind: FilterChoice['kind'],
  ) => out.push({ id: groupId(group), group, name, detail, kind })
  add({ source: 'availability' }, copy.source.availability, copy.detail.availability, 'builtIn')
  add({ source: 'price' }, copy.source.price, copy.detail.price, 'builtIn')
  if (sources.productTypes > 0) {
    add(
      { source: 'productType' },
      copy.source.productType,
      copy.detail.productType(sources.productTypes),
      'builtIn',
    )
  }
  if (sources.vendors > 0) {
    add({ source: 'vendor' }, copy.source.vendor, copy.detail.vendor(sources.vendors), 'builtIn')
  }
  if (sources.giftCards) {
    add({ source: 'giftCard' }, copy.source.giftCard, copy.detail.giftCard, 'builtIn')
  }
  add({ source: 'tags' }, copy.source.tags, copy.detail.tags, 'builtIn')
  for (const o of sources.options) {
    add({ source: 'option', key: o.key }, o.name, copy.detail.option(o.values), 'options')
  }
  for (const m of sources.metafields) {
    add(
      { source: 'metafield', key: m.key },
      m.name,
      `${m.key} · ${copy.detail.metafield(m.products)}`,
      'metafields',
    )
  }
  for (const t of sources.tagGroups) {
    add(
      { source: 'tagGroup', key: t.prefix },
      t.name,
      copy.detail.tagGroup(t.prefix, t.values.map((v) => v.label).join(', ')),
      'tagGroups',
    )
  }
  return out
}

/** A group's name in the list: its own label, else what the catalogue calls it. */
export function choiceName(group: FilterGroupConfig, choices: FilterChoice[], copy: Copy): string {
  const found = choices.find((c) => c.id === groupId(group))
  if (found) return found.name
  if (group.source === 'tagGroup') return tagPrefixLabel(group.key ?? '')
  return group.key ?? copy.source[group.source]
}

/** The line under a group's name: where its values come from. */
export function choiceDetail(
  group: FilterGroupConfig,
  choices: FilterChoice[],
  copy: Copy,
): string {
  const found = choices.find((c) => c.id === groupId(group))
  return found ? found.detail : copy.source[group.source]
}

/**
 * The filters a store shows before it chooses (the storefront's default, `resolveFilterGroups`
 * with no settings): availability, gift cards, price, options, marked fields, type, brand, tags.
 */
export function defaultFilterGroups(sources: FilterSources): FilterGroupConfig[] {
  const marked = sources.metafields.filter((m) => m.marked)
  return [
    { source: 'availability' },
    ...(sources.giftCards ? [{ source: 'giftCard' as const }] : []),
    { source: 'price' },
    ...sources.options.map((o) => ({ source: 'option' as const, key: o.key })),
    ...marked.map((m) => ({ source: 'metafield' as const, key: m.key })),
    ...(sources.productTypes > 1 ? [{ source: 'productType' as const }] : []),
    ...(sources.vendors > 1 ? [{ source: 'vendor' as const }] : []),
    { source: 'tags' },
  ]
}
