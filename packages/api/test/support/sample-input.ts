/**
 * Builds a valid-looking input for any oRPC procedure from its Zod (v4) input schema, so a
 * test can call every procedure in the router without a hand-written input per procedure.
 *
 * Leaves are chosen to pass their own schema: uuids come from `pickId` (the caller decides
 * whose ids: the caller's own store, or the other store, to probe for leaks), strings and
 * numbers are tried from a short candidate list until one parses (so `min(2)`, an email,
 * a pincode regex and a slug all get something they accept). Optional keys are left out
 * unless they look like ids, which is where cross-store bugs live.
 */

type Def = { type: string } & Record<string, unknown>
type Schema = {
  _zod: { def: Def }
  safeParse: (v: unknown) => { success: boolean }
}

/** Decides the uuid for a leaf, from the nearest object key (`productId`, `ids`, `id`). */
export type PickId = (key: string) => string | undefined

const STRING_CANDIDATES = [
  'leak-test',
  'leaktest',
  'Leak test value',
  'leak@example.test',
  '110001',
  '9876543210',
  'https://example.test/leak',
  '#4ea674',
  '2026-01-15',
  '2026-01',
  '2026-01-15T10:00:00.000Z',
  '10:00',
  'ABCDE1234F',
  '27AAPFU0939F1ZV',
  'a',
  'x'.repeat(12),
]
const NUMBER_CANDIDATES = [1, 0, 10, 100, 1000, 2026, 5, -1, 0.5]

const defOf = (s: unknown): Def | undefined => (s as Schema | undefined)?._zod?.def
const parses = (s: unknown, v: unknown) => {
  try {
    return (s as Schema).safeParse(v).success
  } catch {
    return false
  }
}

const isIdKey = (key: string) => /(^id$|^ids$|Id$|Ids$)/.test(key)

function sample(schema: unknown, key: string, pickId: PickId, depth: number): unknown {
  const def = defOf(schema)
  if (!def || depth > 8) return undefined
  switch (def.type) {
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'catch':
    case 'readonly':
    case 'nonoptional':
      return sample(def.innerType, key, pickId, depth + 1)
    case 'pipe':
      return sample(def.in, key, pickId, depth + 1)
    case 'lazy':
      return sample((def.getter as () => unknown)(), key, pickId, depth + 1)
    case 'object': {
      const out: Record<string, unknown> = {}
      for (const [k, child] of Object.entries(def.shape as Record<string, unknown>)) {
        const optional = defOf(child)?.type === 'optional' || defOf(child)?.type === 'default'
        if (optional && !isIdKey(k)) continue
        const v = sample(child, k, pickId, depth + 1)
        if (v !== undefined) out[k] = v
      }
      return out
    }
    case 'array': {
      const item = sample(def.element, key, pickId, depth + 1)
      for (const candidate of [[], [item], [item, item]]) {
        if (parses(schema, candidate)) return candidate
      }
      return item === undefined ? [] : [item]
    }
    case 'tuple':
      return (def.items as unknown[]).map((s, i) => sample(s, `${key}${i}`, pickId, depth + 1))
    case 'record':
      return {}
    case 'union': {
      for (const option of def.options as unknown[]) {
        const v = sample(option, key, pickId, depth + 1)
        if (parses(option, v)) return v
      }
      return sample((def.options as unknown[])[0], key, pickId, depth + 1)
    }
    case 'intersection': {
      const left = sample(def.left, key, pickId, depth + 1)
      const right = sample(def.right, key, pickId, depth + 1)
      return typeof left === 'object' && typeof right === 'object'
        ? { ...(left as object), ...(right as object) }
        : left
    }
    case 'enum':
      return Object.values(def.entries as Record<string, unknown>)[0]
    case 'literal':
      return (def.values as unknown[])[0]
    case 'boolean':
      return false
    case 'date':
      return new Date('2026-01-15T10:00:00Z')
    case 'number':
    case 'int':
    case 'bigint':
      return NUMBER_CANDIDATES.find((n) => parses(schema, n)) ?? 1
    case 'string': {
      if (def.format === 'uuid' || def.format === 'guid') return pickId(key)
      return STRING_CANDIDATES.find((s) => parses(schema, s)) ?? 'leak-test'
    }
    case 'any':
    case 'unknown':
      return {}
    default:
      return undefined
  }
}

/** An input for `schema` (undefined when the procedure takes none). */
export function sampleInput(schema: unknown, pickId: PickId): unknown {
  if (!schema) return undefined
  return sample(schema, '', pickId, 0)
}

/** Every uuid string anywhere in a value, so a call's own input ids can be told apart from a leak. */
export function uuidsIn(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
      out.add(value)
  } else if (Array.isArray(value)) {
    for (const v of value) uuidsIn(v, out)
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) uuidsIn(v, out)
  }
  return out
}
