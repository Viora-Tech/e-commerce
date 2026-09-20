import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { runWorkflow, type WorkflowStep } from './run'

type S = { log: string[] }

type Plan = { fails: boolean; hasCompensate: boolean }

function stepFrom(i: number, plan: Plan): WorkflowStep<S> {
  return {
    name: `s${i}`,
    async run(s) {
      s.log.push(`run:s${i}`)
      if (plan.fails) throw new Error(`s${i} failed`)
      return {}
    },
    ...(plan.hasCompensate
      ? {
          async compensate(s: S) {
            s.log.push(`undo:s${i}`)
          },
        }
      : {}),
  }
}

const planArb = fc.record({ fails: fc.boolean(), hasCompensate: fc.boolean() })

describe('runWorkflow invariants', () => {
  it('for any step sequence: runs stop at the first failure, then every completed step with a compensation is undone exactly once, in reverse', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(planArb, { minLength: 1, maxLength: 12 }), async (plans) => {
        const s: S = { log: [] }
        const steps = plans.map((p, i) => stepFrom(i, p))
        const firstFail = plans.findIndex((p) => p.fails)
        const outcome = await runWorkflow(s, steps).then(
          () => 'ok' as const,
          () => 'threw' as const,
        )

        if (firstFail === -1) {
          expect(outcome).toBe('ok')
          expect(s.log).toEqual(plans.map((_, i) => `run:s${i}`))
          return
        }

        expect(outcome).toBe('threw')
        const expectedRuns = plans.slice(0, firstFail + 1).map((_, i) => `run:s${i}`)
        const expectedUndos = plans
          .slice(0, firstFail)
          .map((p, i) => (p.hasCompensate ? `undo:s${i}` : null))
          .filter((x): x is string => x !== null)
          .reverse()
        expect(s.log).toEqual([...expectedRuns, ...expectedUndos])
      }),
      { numRuns: 300 },
    )
  })
})
