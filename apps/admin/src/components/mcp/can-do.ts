import { API_AREAS, type ApiScopes, scopeParts } from '@commerce/core/api-access'
import type { mcpContent } from '@/data/mcp'

type Copy = typeof mcpContent

const list = (copy: Copy, areas: readonly (keyof Copy['areas'])[]) =>
  areas.map((a) => copy.areas[a].toLowerCase()).join(', ')

/**
 * Figma "Can do", two lines: what a client reads, then the areas where it may run any admin
 * action its member's role allows, and what waits for approval (sensitive actions always do).
 */
export function clientCanDo(copy: Copy, scopes: ApiScopes, requireApproval: boolean) {
  const { reads, writes } = scopeParts(scopes)
  const first =
    reads.length === API_AREAS.length ? copy.canDo.readAll : copy.canDo.read(list(copy, reads))
  const second = writes.length
    ? [
        copy.canDo.propose(list(copy, writes)),
        requireApproval ? copy.canDo.needsApproval : copy.canDo.sensitiveApproval,
      ].join(' · ')
    : copy.canDo.readOnly
  return { first, second }
}

/** Figma "Scopes" for a token: the areas, then "Read & write" or "Read". */
export function tokenScopes(copy: Copy, scopes: ApiScopes) {
  const { reads, writes } = scopeParts(scopes)
  const names = reads.map((a) => copy.areas[a])
  return {
    first: names.join(', '),
    second: writes.length ? copy.canDo.readWrite : copy.access.read,
  }
}
