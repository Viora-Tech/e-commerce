import { describe, expect, it } from 'vitest'
import { WorkflowDefinitionSchema, walkNodes } from '../automations/definition'
import { mapAutomation, mapRun, nodeIdsFor, ruleFor } from './automation-engine-map'
import { AUTOMATION_TEMPLATES, type AutomationStep } from './automation-steps'

const legacy = (trigger: string, steps: AutomationStep[], settings: object = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  template: 'abandoned_checkout',
  trigger,
  name: 'x',
  status: 'active' as const,
  steps,
  settings,
})

describe('Growth → engine definition mapping', () => {
  for (const t of AUTOMATION_TEMPLATES) {
    it(`maps the ${t.id} template to a valid straight-line workflow`, () => {
      const m = mapAutomation({ ...legacy(t.trigger, t.steps, t.settings), template: t.id })
      expect(m).not.toBeNull()
      const parsed = WorkflowDefinitionSchema.safeParse(m?.definition)
      expect(parsed.success).toBe(true)
      // Steps 1:1, in order, ids kept.
      expect(walkNodes(m?.definition as never).map((n) => n.id)).toEqual(t.steps.map((s) => s.id))
      expect(m?.nodeIds).toEqual(t.steps.map((s) => s.id))
    })
  }

  it('keeps the trigger settings, conversion exit and on/off', () => {
    const t = AUTOMATION_TEMPLATES.find((x) => x.id === 'abandoned_checkout')
    const m = mapAutomation({ ...legacy('checkout_abandoned', t?.steps ?? []), status: 'paused' })
    expect(m?.definition.trigger).toEqual({
      type: 'checkout.abandoned',
      config: { afterMinutes: 60 },
    })
    expect(m?.definition.settings).toEqual({ exitOnOrder: true })
    expect(m?.status).toBe('off')
    const cod = mapAutomation(legacy('cod_order_placed', []))
    expect(cod?.definition.settings).toEqual({})
    expect(cod?.definition.trigger).toEqual({
      type: 'order.cod_placed',
      config: { includeTest: false },
    })
    expect(
      mapAutomation(legacy('customer_lapsed', [], { lapsedDays: 120 }))?.definition.trigger,
    ).toEqual({ type: 'customer.lapsed', config: { lapsedDays: 120 } })
  })

  it('maps message steps to the marketing actions, never failing the run', () => {
    const m = mapAutomation(
      legacy('cart_abandoned', [
        { id: 'e', type: 'email', subject: 'Hi', previewText: 'p', blocks: [] },
        { id: 'w', type: 'wait', minutes: 30 },
        {
          id: 'wa',
          type: 'whatsapp',
          template: { name: 'nudge', language: 'en', variables: ['{first_name}'] },
        },
      ]),
    )
    expect(m?.definition.start).toBe('e')
    expect(m?.definition.nodes.e).toMatchObject({
      kind: 'action',
      action: 'marketing.send_email',
      config: { subject: 'Hi', previewText: 'p', blocks: [] },
      next: 'w',
      onError: 'continue',
    })
    expect(m?.definition.nodes.w).toEqual({ kind: 'wait', id: 'w', minutes: 30, next: 'wa' })
    expect(m?.definition.nodes.wa).toMatchObject({
      action: 'marketing.send_whatsapp',
      config: { template: { name: 'nudge' } },
      next: null,
    })
  })

  it('maps conditions to "continue only if" on the trigger subject', () => {
    const cond = (
      field: 'cart_value' | 'order_count' | 'has_ordered' | 'accepts_marketing',
      op: 'gte' | 'lte' | 'eq',
      value: string,
    ) => ({ id: 'c', type: 'condition', field, op, value }) as const
    expect(ruleFor(cond('cart_value', 'gte', '1500.5'), 'cart')).toEqual({
      field: 'cart.total',
      op: 'gte',
      value: 150050,
    })
    expect(ruleFor(cond('cart_value', 'lte', '999'), 'order')).toEqual({
      field: 'order.total',
      op: 'lte',
      value: 99900,
    })
    expect(ruleFor(cond('order_count', 'eq', '2'), 'customer')).toEqual({
      field: 'customer.order_count',
      op: 'eq',
      value: 2,
    })
    expect(ruleFor(cond('has_ordered', 'eq', 'false'), 'cart')).toEqual({
      field: 'cart.customer.has_ordered',
      op: 'is_false',
    })
    expect(ruleFor(cond('accepts_marketing', 'eq', 'true'), 'order')).toEqual({
      field: 'order.customer.accepts_marketing',
      op: 'is_true',
    })
    // The old runner had no basket for lapsed/subscribed runs and never passed these.
    expect(ruleFor(cond('cart_value', 'gte', '10'), 'customer').op).toBe('is_empty')
    expect(ruleFor(cond('order_count', 'gte', 'abc'), 'cart').op).toBe('is_empty')

    const m = mapAutomation(
      legacy('customer_subscribed', [cond('accepts_marketing', 'eq', 'true')]),
    )
    expect(m?.definition.nodes.c).toMatchObject({
      kind: 'condition',
      next: null,
      otherwise: null,
      otherwiseStops: true,
    })
  })

  it('renames step ids that are not valid or unique node ids', () => {
    const ids = nodeIdsFor([
      { id: 'has space', type: 'wait', minutes: 1 },
      { id: 'a', type: 'wait', minutes: 1 },
      { id: 'a', type: 'wait', minutes: 1 },
    ])
    expect(ids).toEqual(['step-0', 'a', 'step-2'])
  })

  it('ignores unknown triggers', () => {
    expect(mapAutomation(legacy('nope', []))).toBeNull()
  })
})

describe('Growth → engine run mapping', () => {
  const ids = ['email-1', 'wait-1', 'whatsapp-1']
  const base = { customerId: 'cu', cartId: 'ca', orderId: 'or' }

  it('parks an active run on the step it would run next', () => {
    expect(mapRun('checkout_abandoned', ids, { ...base, status: 'active', stepIndex: 2 })).toEqual({
      status: 'waiting',
      cursor: 'whatsapp-1',
      subjectType: 'cart',
      subjectId: 'ca',
    })
    expect(
      mapRun('checkout_abandoned', ids, { ...base, status: 'active', stepIndex: 0 }).cursor,
    ).toBe('email-1')
  })

  it('keeps finished runs finished, with the subject of their trigger', () => {
    expect(mapRun('first_order', ids, { ...base, status: 'converted', stepIndex: 3 })).toEqual({
      status: 'converted',
      cursor: null,
      subjectType: 'order',
      subjectId: 'or',
    })
    expect(
      mapRun('customer_lapsed', ids, { ...base, status: 'stopped', stepIndex: 1 }),
    ).toMatchObject({
      status: 'stopped',
      subjectType: 'customer',
      subjectId: 'cu',
    })
    expect(mapRun('cart_abandoned', ids, { ...base, status: 'active', stepIndex: 3 }).status).toBe(
      'completed',
    )
  })
})
