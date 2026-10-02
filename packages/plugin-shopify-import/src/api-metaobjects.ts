/**
 * Shopify metaobjects ("Content types" and their entries here): every
 * definition, then each definition's entries page by page.
 */
import type { ShopifyClient } from './shopify-client'
import type { NFieldDefinition, NMetaobject, NMetaobjectDefinition } from './types'

type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }

const FIELD_DEFINITION_FIELDS =
  'key name description required type { name } validations { name value }'

export type GFieldDefinition = {
  key: string
  name: string
  description: string | null
  required?: boolean | null
  type: { name: string }
  validations: { name: string; value: string | null }[]
}

export const mapFieldDefinition = (f: GFieldDefinition): NFieldDefinition => ({
  key: f.key,
  name: f.name || f.key,
  description: f.description || null,
  required: Boolean(f.required),
  type: f.type.name,
  validations: f.validations ?? [],
})

const METAOBJECT_DEFINITIONS_QUERY = `query MetaobjectDefinitions($cursor: String) {
  metaobjectDefinitions(first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id type name description displayNameKey
      access { storefront }
      fieldDefinitions { ${FIELD_DEFINITION_FIELDS} }
    }
  }
}`

type GDefinition = {
  id: string
  type: string
  name: string
  description: string | null
  displayNameKey: string | null
  access: { storefront: string | null } | null
  fieldDefinitions: GFieldDefinition[]
}

export async function fetchMetaobjectDefinitions(
  client: ShopifyClient,
): Promise<NMetaobjectDefinition[]> {
  const out: NMetaobjectDefinition[] = []
  for await (const nodes of client.paginate<GDefinition>(
    METAOBJECT_DEFINITIONS_QUERY,
    (d) => (d as { metaobjectDefinitions: Page<GDefinition> }).metaobjectDefinitions,
    {},
    250,
  )) {
    for (const d of nodes) {
      out.push({
        sourceId: d.id,
        type: d.type,
        name: d.name || d.type,
        description: d.description || null,
        displayNameKey: d.displayNameKey,
        fields: d.fieldDefinitions.map(mapFieldDefinition),
        storefrontAccess: d.access?.storefront !== 'NONE',
      })
    }
  }
  return out
}

const METAOBJECTS_QUERY = `query Metaobjects($type: String!, $cursor: String) {
  metaobjects(type: $type, first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle displayName
      capabilities { publishable { status } }
      fields { key type value }
    }
  }
}`

type GMetaobject = {
  id: string
  handle: string
  displayName: string | null
  capabilities: { publishable: { status: string } | null } | null
  fields: { key: string; type: string; value: string | null }[]
}

export async function* fetchMetaobjects(
  client: ShopifyClient,
  definition: Pick<NMetaobjectDefinition, 'sourceId' | 'type'>,
): AsyncGenerator<NMetaobject[]> {
  for await (const nodes of client.paginate<GMetaobject>(
    METAOBJECTS_QUERY,
    (d) => (d as { metaobjects: Page<GMetaobject> }).metaobjects,
    { type: definition.type },
    300,
  )) {
    yield nodes.map((m) => ({
      sourceId: m.id,
      definitionSourceId: definition.sourceId,
      handle: m.handle,
      displayName: m.displayName || m.handle,
      status: m.capabilities?.publishable?.status === 'DRAFT' ? 'draft' : 'active',
      fields: m.fields.map((f) => ({ key: f.key, type: f.type, value: f.value })),
    }))
  }
}
