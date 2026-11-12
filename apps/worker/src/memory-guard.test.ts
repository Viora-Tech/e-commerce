import { describe, expect, it } from 'vitest'
import {
  createMemoryGuard,
  DEFAULT_THRESHOLDS,
  type GuardedWorker,
  nextLevel,
  priorityOf,
  readMemoryLimit,
  SWEEPS_WORKER,
  sweepRuns,
  workerPlan,
} from './memory-guard'

const MB = 1024 * 1024

describe('nextLevel', () => {
  it('climbs as soon as a threshold is crossed', () => {
    expect(nextLevel('normal', 0.5)).toBe('normal')
    expect(nextLevel('normal', 0.7)).toBe('slow')
    expect(nextLevel('normal', 0.86)).toBe('critical')
    expect(nextLevel('slow', 0.85)).toBe('critical')
  })

  it('comes down only past a lower threshold, so a hovering reading does not flap', () => {
    expect(nextLevel('slow', 0.65)).toBe('slow')
    expect(nextLevel('slow', 0.59)).toBe('normal')
    expect(nextLevel('critical', 0.8)).toBe('critical')
    expect(nextLevel('critical', 0.69)).toBe('slow')
    expect(nextLevel('critical', 0.5)).toBe('normal')
    expect(nextLevel('normal', 0.65)).toBe('normal')
  })

  it('uses the thresholds it is given', () => {
    const t = { ...DEFAULT_THRESHOLDS, slow: 0.5, critical: 0.6, resume: 0.4 }
    expect(nextLevel('normal', 0.55, t)).toBe('slow')
    expect(nextLevel('normal', 0.6, t)).toBe('critical')
  })
})

describe('workerPlan', () => {
  it('normal: everything runs at its own concurrency', () => {
    expect(workerPlan('normal', 'bulk', 4)).toEqual({ paused: false, concurrency: 4 })
  })
  it('slow: bulk pauses, normal halves (at least one), critical is untouched', () => {
    expect(workerPlan('slow', 'bulk', 4).paused).toBe(true)
    expect(workerPlan('slow', 'normal', 5)).toEqual({ paused: false, concurrency: 3 })
    expect(workerPlan('slow', 'normal', 1)).toEqual({ paused: false, concurrency: 1 })
    expect(workerPlan('slow', 'critical', 5)).toEqual({ paused: false, concurrency: 5 })
  })
  it('critical: only critical queues run', () => {
    expect(workerPlan('critical', 'normal', 5).paused).toBe(true)
    expect(workerPlan('critical', 'bulk', 5).paused).toBe(true)
    expect(workerPlan('critical', 'critical', 5)).toEqual({ paused: false, concurrency: 5 })
  })
})

describe('priorityOf', () => {
  it('keeps order emails and payments, pauses imports and images first', () => {
    expect(priorityOf('notifications')).toBe('critical')
    expect(priorityOf('unpaid-order-expiry')).toBe('critical')
    expect(priorityOf('outbox-relay')).toBe('critical')
    expect(priorityOf('app-jobs')).toBe('bulk')
    expect(priorityOf('media-process')).toBe('bulk')
    expect(priorityOf('marketing-send')).toBe('bulk')
    expect(priorityOf('order-push')).toBe('normal')
  })

  it('never pauses the shared sweeps worker: its jobs are held back one sweep at a time', () => {
    expect(priorityOf(SWEEPS_WORKER)).toBe('critical')
    expect(workerPlan('critical', priorityOf(SWEEPS_WORKER), 6)).toEqual({
      paused: false,
      concurrency: 6,
    })
  })
})

describe('sweepRuns', () => {
  const payments = ['unpaid-order-expiry', 'preorder-balance', 'payment-fees', 'refund-sync']
  it('payment sweeps run at every level', () => {
    for (const name of payments) {
      expect(sweepRuns('normal', name)).toBe(true)
      expect(sweepRuns('slow', name)).toBe(true)
      expect(sweepRuns('critical', name)).toBe(true)
    }
  })
  it('housekeeping waits at slow; the rest wait at critical', () => {
    expect(sweepRuns('normal', 'home-cards')).toBe(true)
    expect(sweepRuns('slow', 'home-cards')).toBe(false)
    expect(sweepRuns('slow', 'shipping-tracker')).toBe(true)
    expect(sweepRuns('critical', 'shipping-tracker')).toBe(false)
    expect(sweepRuns('critical', 'retention-prune')).toBe(false)
  })
})

describe('readMemoryLimit', () => {
  const files = (map: Record<string, number | null>) => (p: string) => map[p] ?? null
  it('reads cgroup v2 first, then v1', () => {
    expect(readMemoryLimit(512, files({ '/sys/fs/cgroup/memory.max': 1536 * MB }))).toEqual({
      bytes: 1536 * MB,
      source: 'cgroup',
    })
    expect(
      readMemoryLimit(
        undefined,
        files({ '/sys/fs/cgroup/memory/memory.limit_in_bytes': 1024 * MB }),
      ),
    ).toEqual({ bytes: 1024 * MB, source: 'cgroup' })
  })
  it('falls back to the env var, then the machine', () => {
    expect(readMemoryLimit(800, files({}))).toEqual({ bytes: 800 * MB, source: 'env' })
    expect(readMemoryLimit(undefined, files({})).source).toBe('machine')
  })
})

function fakeWorker(concurrency: number) {
  const w = {
    concurrency,
    pauses: 0,
    resumes: 0,
    paused: false,
    async pause() {
      w.pauses += 1
      w.paused = true
    },
    resume() {
      w.resumes += 1
      w.paused = false
    },
  }
  return w satisfies GuardedWorker
}

describe('createMemoryGuard', () => {
  const setup = () => {
    let rss = 100 * MB
    let clock = 0
    let exits = 0
    let gcs = 0
    const notifications = fakeWorker(5)
    const appEvents = fakeWorker(3)
    const imports = fakeWorker(4)
    const guard = createMemoryGuard({
      workers: [
        [notifications, 'notifications'],
        [appEvents, 'app-events'],
        [imports, 'app-jobs'],
      ],
      limitBytes: 1000 * MB,
      sample: () => ({ rss, heap: rss / 2 }),
      now: () => clock,
      gc: () => {
        gcs += 1
      },
      exit: () => {
        exits += 1
      },
    })
    return {
      guard,
      notifications,
      appEvents,
      imports,
      set: (mb: number) => {
        rss = mb * MB
      },
      tick: (ms: number) => {
        clock += ms
      },
      exits: () => exits,
      gcs: () => gcs,
    }
  }

  it('slows down, then keeps only critical queues, then resumes everything', () => {
    const s = setup()
    s.set(720)
    expect(s.guard.check()).toBe('slow')
    expect(s.imports.paused).toBe(true)
    expect(s.appEvents).toMatchObject({ paused: false, concurrency: 2 })
    expect(s.notifications).toMatchObject({ paused: false, concurrency: 5 })

    s.set(900)
    expect(s.guard.check()).toBe('critical')
    expect(s.appEvents.paused).toBe(true)
    expect(s.notifications.paused).toBe(false)
    expect(s.gcs()).toBe(1)

    s.set(550)
    expect(s.guard.check()).toBe('normal')
    expect(s.imports).toMatchObject({ paused: false, concurrency: 4 })
    expect(s.appEvents).toMatchObject({ paused: false, concurrency: 3 })
    expect(s.imports.pauses).toBe(1)
    expect(s.imports.resumes).toBe(1)
  })

  it('never pauses a worker twice while the level holds', () => {
    const s = setup()
    s.set(720)
    s.guard.check()
    s.guard.check()
    s.set(650)
    expect(s.guard.check()).toBe('slow')
    expect(s.imports.pauses).toBe(1)
  })

  it('exits cleanly once memory stays at the exit level long enough, and only once', () => {
    const s = setup()
    s.set(960)
    s.guard.check()
    s.tick(30_000)
    s.guard.check()
    expect(s.exits()).toBe(0)
    s.tick(30_000)
    s.guard.check()
    expect(s.exits()).toBe(1)
    s.tick(30_000)
    s.guard.check()
    expect(s.exits()).toBe(1)
  })

  it('a dip below the exit level restarts the wait', () => {
    const s = setup()
    s.set(960)
    s.guard.check()
    s.tick(50_000)
    s.set(900)
    s.guard.check()
    s.set(960)
    s.tick(5_000)
    s.guard.check()
    s.tick(50_000)
    s.guard.check()
    expect(s.exits()).toBe(0)
  })
})
