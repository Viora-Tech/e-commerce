import { logger } from '@commerce/observability/logging'
import { describe, expect, it, vi } from 'vitest'
import { runWorkflow, type WorkflowStep } from './run'

type S = { log: string[]; value: number }

function step(name: string, opts: { fail?: boolean; compensate?: boolean } = {}): WorkflowStep<S> {
  return {
    name,
    async run(s) {
      s.log.push(`run:${name}`)
      if (opts.fail) throw new Error(`${name} failed`)
      return { value: s.value + 1 }
    },
    ...(opts.compensate
      ? {
          async compensate(s: S) {
            s.log.push(`undo:${name}`)
          },
        }
      : {}),
  }
}

describe('runWorkflow', () => {
  it('runs steps in order and merges state', async () => {
    const s = await runWorkflow<S>({ log: [], value: 0 }, [step('a'), step('b'), step('c')])
    expect(s.value).toBe(3)
    expect(s.log).toEqual(['run:a', 'run:b', 'run:c'])
  })

  it('on failure compensates completed steps in reverse and rethrows the original error', async () => {
    const s: S = { log: [], value: 0 }
    await expect(
      runWorkflow(s, [
        step('a', { compensate: true }),
        step('b', { compensate: true }),
        step('c', { fail: true, compensate: true }),
        step('d', { compensate: true }),
      ]),
    ).rejects.toThrow('c failed')
    expect(s.log).toEqual(['run:a', 'run:b', 'run:c', 'undo:b', 'undo:a'])
  })

  it('a failing compensation is logged and does not stop the others', async () => {
    const errors: string[] = []
    const s: S = { log: [], value: 0 }
    const broken: WorkflowStep<S> = {
      name: 'b',
      async run() {
        return {}
      },
      async compensate() {
        throw new Error('undo b broke')
      },
    }
    await expect(
      runWorkflow(s, [step('a', { compensate: true }), broken, step('c', { fail: true })], {
        error: (msg) => errors.push(msg),
      }),
    ).rejects.toThrow('c failed')
    expect(s.log).toEqual(['run:a', 'run:c', 'undo:a'])
    expect(errors).toEqual(['compensation failed: b'])
  })

  it('logs a failing compensation through the shared logger by default', async () => {
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const s: S = { log: [], value: 0 }
    const broken: WorkflowStep<S> = {
      name: 'b',
      async run() {
        return {}
      },
      async compensate() {
        throw new Error('undo b broke')
      },
    }
    await expect(runWorkflow(s, [broken, step('c', { fail: true })])).rejects.toThrow('c failed')
    expect(spy).toHaveBeenCalledWith('compensation failed: b', { error: expect.any(Error) })
    spy.mockRestore()
  })
})
