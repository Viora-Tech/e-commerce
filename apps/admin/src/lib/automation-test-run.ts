import { type AutomationStep, conditionHolds } from '@commerce/core/marketing'

/** A made-up shopper the test run walks through the flow with. */
export type TestShopper = {
  id: string
  cartValuePaise: number
  items: number
  orderCount: number
  acceptsMarketing: boolean
}

export const TEST_SHOPPERS: readonly TestShopper[] = [
  { id: 'big', cartValuePaise: 449_900, items: 2, orderCount: 1, acceptsMarketing: true },
  { id: 'small', cartValuePaise: 99_900, items: 1, orderCount: 0, acceptsMarketing: true },
  { id: 'no-consent', cartValuePaise: 249_900, items: 1, orderCount: 2, acceptsMarketing: false },
]

export type TestEvent =
  | { kind: 'trigger' }
  | { kind: 'wait'; minutes: number }
  | { kind: 'whatsapp'; template: string; skipped: boolean }
  | { kind: 'email'; subject: string; skipped: boolean }
  | { kind: 'condition'; passed: boolean }
  | { kind: 'end' }

export type TestRun = {
  events: TestEvent[]
  /** Whether the shopper reached the end, or a condition stopped them. */
  reachedEnd: boolean
  messages: number
}

/**
 * Walks the flow without sending anything: waits are skipped, messages are counted only when the
 * shopper would receive them (marketing needs consent), and a failed condition ends the run.
 */
export function runTest(steps: AutomationStep[], shopper: TestShopper): TestRun {
  const events: TestEvent[] = [{ kind: 'trigger' }]
  let messages = 0
  for (const step of steps) {
    if (step.type === 'wait') {
      events.push({ kind: 'wait', minutes: step.minutes })
    } else if (step.type === 'whatsapp') {
      const skipped = !shopper.acceptsMarketing
      if (!skipped) messages++
      events.push({ kind: 'whatsapp', template: step.template.name, skipped })
    } else if (step.type === 'email') {
      const skipped = !shopper.acceptsMarketing
      if (!skipped) messages++
      events.push({ kind: 'email', subject: step.subject, skipped })
    } else {
      const passed = conditionHolds(step, {
        cartValuePaise: shopper.cartValuePaise,
        orderCount: shopper.orderCount,
        acceptsMarketing: shopper.acceptsMarketing,
      })
      events.push({ kind: 'condition', passed })
      if (!passed) return { events, reachedEnd: false, messages }
    }
  }
  events.push({ kind: 'end' })
  return { events, reachedEnd: true, messages }
}
