import { describe, expect, it, vi } from 'vitest'
import { type AgentMcpEnv, answerAgentRpc } from './agent-mcp'

const env = (): AgentMcpEnv => ({
  storeName: 'Waimers',
  origin: 'https://shop.test',
  inStore: vi.fn() as unknown as AgentMcpEnv['inStore'],
})

describe('store agent MCP', () => {
  it('answers initialize with the asked version and the store name', async () => {
    const r = await answerAgentRpc(env(), {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26' },
    })
    expect(r).toMatchObject({
      id: 1,
      result: { protocolVersion: '2025-03-26', serverInfo: { title: 'Waimers' } },
    })
  })

  it('lists four read-only tools', async () => {
    const r = (await answerAgentRpc(env(), { jsonrpc: '2.0', id: 2, method: 'tools/list' })) as {
      result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] }
    }
    expect(r.result.tools.map((t) => t.name)).toEqual([
      'search_catalog',
      'get_product',
      'search_policies_and_faqs',
      'get_store_info',
    ])
    expect(r.result.tools.every((t) => t.annotations.readOnlyHint)).toBe(true)
  })

  it('rejects a bad search without touching the store', async () => {
    const e = env()
    const r = (await answerAgentRpc(e, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'search_catalog', arguments: { query: 'x' } },
    })) as { result: { isError: boolean } }
    expect(r.result.isError).toBe(true)
    expect(e.inStore).not.toHaveBeenCalled()
  })

  it('ignores notifications and refuses unknown methods', async () => {
    expect(
      await answerAgentRpc(env(), { jsonrpc: '2.0', method: 'notifications/initialized' }),
    ).toBeNull()
    expect(await answerAgentRpc(env(), { jsonrpc: '2.0', id: 4, method: 'nope' })).toMatchObject({
      error: { code: -32601 },
    })
  })
})
