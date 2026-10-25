/**
 * Sweep: MCP `searchActions` describes each admin procedure with the first sentence of its
 * JSDoc, from `packages/api/src/mcp/action-docs.generated.ts`. Not a ratchet: when a router's
 * JSDoc changes, regenerate it with `bun scripts/gen-mcp-action-docs.ts`.
 */
import { describe, expect, it } from 'vitest'
import { ACTION_DOCS } from '../../packages/api/src/mcp/action-docs.generated'
import { collectActionDocs } from '../gen-mcp-action-docs'

describe('sweep: mcp-action-docs', () => {
  it('matches the routers (run bun scripts/gen-mcp-action-docs.ts)', () => {
    expect(ACTION_DOCS).toEqual(collectActionDocs())
  })
})
