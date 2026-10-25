/** SOURCE OF TRUTH: automation contract tests — WHAT: the pure parts of the engine: definition tree checks, the publish piece check (plan, permissions, Owner-only approval), merge tags, outbox → event mapping, retry backoff and IST schedules / WHY: these run without a database, so the contract every other agent builds on is pinned. */
import { describe, expect, it } from 'vitest'
import { permissions } from '../permissions/statement'
import { isOrderUpdateTemplate } from './actions/order-update'
import { builtinAction } from './catalogue'
import { evaluateRulesAt } from './conditions/evaluate'
import { definitionIssues, type WorkflowDefinition, WorkflowDefinitionSchema } from './definition'
import { retryDelayMs } from './engine/interpreter'
import { nextFireAt } from './engine/tick'
import { eventForOutbox } from './engine/trigger'
import { mergeTagsIn, renderMergeTags } from './merge-tags'
import { pieceCatalogue, pieceIssues } from './registry'
import { BUILTIN_TEMPLATES } from './templates'

const def = (
  nodes: WorkflowDefinition['nodes'],
  start: string | null = 'a',
): WorkflowDefinition => ({
  schemaVersion: 1,
  trigger: { type: 'order.paid', config: {} },
  start,
  nodes,
  settings: {},
})
const tag = (id: string, next: string | null = null) => ({
  kind: 'action' as const,
  id,
  action: 'order.add_tags',
  config: { tags: ['VIP'] },
  next,
  onError: 'stop' as const,
})
const totalOver = {
  join: 'and' as const,
  rules: [{ field: 'order.total', op: 'gt' as const, value: 1 }],
}

describe('definition', () => {
  it('accepts every built-in template', () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(WorkflowDefinitionSchema.safeParse(t.definition).success, t.id).toBe(true)
    }
  })

  it('finds missing, shared, unreachable and looping steps', () => {
    const codes = (d: WorkflowDefinition) => definitionIssues(d).map((i) => i.code)
    expect(codes(def({ a: tag('a', 'zz') }))).toEqual(['missing_node'])
    expect(codes(def({ a: tag('a'), b: tag('b') }))).toEqual(['unreachable'])
    expect(codes(def({ a: tag('a', 'b'), b: tag('b', 'a') }))).toContain('shared_child')
    expect(
      codes(
        def({
          a: { kind: 'condition', id: 'a', rules: totalOver, next: 'b', otherwise: 'b' },
          b: tag('b'),
        }),
      ),
    ).toEqual(['shared_child'])
  })

  it('checks For each: a Find above it, no wait or loop inside', () => {
    const find = {
      kind: 'find' as const,
      id: 'a',
      resource: 'order' as const,
      rules: { join: 'and' as const, rules: [] },
      limit: 10,
      next: 'b',
    }
    const ok = def({
      a: find,
      b: { kind: 'forEach', id: 'b', source: 'a', body: 'c', next: null },
      c: tag('c'),
    })
    expect(definitionIssues(ok)).toEqual([])
    const bad = def({
      a: find,
      b: { kind: 'forEach', id: 'b', source: 'c', body: 'c', next: null },
      c: { kind: 'wait', id: 'c', minutes: 5, next: null },
    })
    expect(
      definitionIssues(bad)
        .map((i) => i.code)
        .sort(),
    ).toEqual(['loop_body', 'loop_source'])
  })

  it('limits rule nesting to two groups', () => {
    const deep = { join: 'and' as const, rules: [{ join: 'or' as const, rules: [totalOver] }] }
    const d = def({ a: { kind: 'condition', id: 'a', rules: deep, next: null, otherwise: null } })
    expect(definitionIssues(d).map((i) => i.code)).toEqual(['rule_depth'])
  })
})

describe('publish check', () => {
  const catalogue = pieceCatalogue({ installedPlugins: [], appInstalled: true })
  const cancel = def({
    a: {
      kind: 'action',
      id: 'a',
      action: 'order.cancel',
      config: {},
      next: null,
      onError: 'stop',
      needsApproval: false,
    },
  })

  it('needs every action permission, and the Owner to stop asking before a cancel', () => {
    const issues = pieceIssues(cancel, {
      catalogue,
      plan: 'growth',
      memberPermissions: [permissions.ORDERS_WRITE],
      isOwner: false,
    })
    expect(issues.map((i) => i.code).sort()).toEqual(['approval_owner_only', 'missing_permission'])
    expect(
      pieceIssues(cancel, { catalogue, plan: 'growth', memberPermissions: [], isOwner: true }),
    ).toEqual([])
  })

  it('keeps HTTP requests off Starter', () => {
    const http = def({
      a: {
        kind: 'action',
        id: 'a',
        action: 'http.request',
        config: { url: 'https://example.com/hook' },
        next: null,
        onError: 'stop',
      },
    })
    const on = (plan: 'starter' | 'growth') =>
      pieceIssues(http, { catalogue, plan, memberPermissions: [], isOwner: true }).map(
        (i) => i.code,
      )
    expect(on('starter')).toEqual(['plan_tier'])
    expect(on('growth')).toEqual([])
  })

  it('offers only marketing pieces without the app', () => {
    const growthOnly = pieceCatalogue({ installedPlugins: [], appInstalled: false })
    expect(growthOnly.action('marketing.send_email')).not.toBeNull()
    expect(growthOnly.action('order.add_tags')).toBeNull()
    expect(growthOnly.trigger('checkout.abandoned')).not.toBeNull()
    expect(growthOnly.trigger('order.paid')).toBeNull()
  })

  it('cancel asks by default', () => {
    expect(builtinAction('order.cancel')).toMatchObject({
      defaultNeedsApproval: true,
      approvalOwnerOnly: true,
      dangerous: true,
    })
  })
})

describe('merge tags', () => {
  it('renders dotted paths, money and lists; unknown tags empty', () => {
    const data = { order: { number: 1042, total: 245000, tags: ['VIP', 'COD'] } }
    const out = renderMergeTags('#{order.number} {order.total} {order.tags} {order.nope}', data)
    expect(out.startsWith('#1042 ₹2,450')).toBe(true)
    expect(out.endsWith(' VIP, COD ')).toBe(true)
    expect(mergeTagsIn('{order.number} and {customer.first_name} {single}')).toEqual([
      'order.number',
      'customer.first_name',
    ])
  })
})

describe('outbox events', () => {
  it('maps a row to its triggers, subject and loop cause', () => {
    const ev = eventForOutbox({
      id: 'r1',
      type: 'order.placed',
      payload: { orderId: 'o1', automation: { runId: 'x', workflowId: 'w', depth: 1 } },
    })
    expect(ev).toMatchObject({
      key: 'outbox:r1',
      subject: { type: 'order', id: 'o1' },
      cause: { depth: 1 },
    })
    expect(ev?.triggerIds).toEqual(['order.placed', 'order.cod_placed', 'customer.first_order'])
    expect(
      eventForOutbox({ id: 'r2', type: 'draft.invoice_sent', payload: { orderId: 'o1' } }),
    ).toBeNull()
    expect(
      eventForOutbox({
        id: 'r3',
        type: 'automation.app_trigger',
        payload: { appTrigger: { trigger: 'meta/lead', key: 'L1', data: {} } },
      }),
    ).toMatchObject({
      key: 'app:meta:L1',
      triggerIds: ['meta/lead'],
      subject: { type: 'none', id: null },
    })
  })
})

describe('timing', () => {
  it('backs off internal actions three times and external ones for about a day', () => {
    expect(retryDelayMs(false, 1)).toBe(5_000)
    expect(retryDelayMs(false, 3)).toBeNull()
    expect(retryDelayMs(true, 1)).toBe(60_000)
    expect(retryDelayMs(true, 7)).toBe(24 * 3600_000)
    expect(retryDelayMs(true, 8)).toBeNull()
  })

  it('fires schedules in IST', () => {
    // 2026-10-23 10:00 IST = 04:30 UTC, a Friday.
    const from = new Date('2026-10-23T04:30:00Z')
    const at = (c: Parameters<typeof nextFireAt>[0]) => nextFireAt(c, from).toISOString()
    expect(at({ every: 'hour' })).toBe('2026-10-23T05:00:00.000Z')
    expect(at({ every: 'day', at: '09:00' })).toBe('2026-10-24T03:30:00.000Z')
    expect(at({ every: 'day', at: '18:30' })).toBe('2026-10-23T13:00:00.000Z')
    expect(at({ every: 'week', weekday: 1, at: '09:00' })).toBe('2026-10-26T03:30:00.000Z')
  })
})

describe('unpaid reminders', () => {
  it('"older than N days" holds only past the line, and the template walks unpaid non-COD orders', () => {
    const now = new Date('2026-10-23T10:00:00Z')
    const rule = {
      join: 'and' as const,
      rules: [{ field: 'order.created_at', op: 'older_than_days' as const, value: 3 }],
    }
    const at = (iso: string) => evaluateRulesAt(rule, { order: { created_at: iso } }, { now }).pass
    expect(at('2026-10-19T10:00:00Z')).toBe(true)
    expect(at('2026-10-21T10:00:00Z')).toBe(false)
    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === 'remind-unpaid-orders')
    expect(tpl && definitionIssues(tpl.definition)).toEqual([])
    expect(isOrderUpdateTemplate('payment_reminder')).toBe(true)
  })
})
