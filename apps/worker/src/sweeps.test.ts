import { describe, expect, it } from 'vitest'
import { runSweep, type Sweep, scheduleSweeps } from './sweeps'

const NOW = 1_800_000_000_000

/** A queue that records what the shared scheduler was asked to do. */
function sharedQueue() {
  const calls: unknown[][] = []
  return {
    calls,
    upsertJobScheduler: async (...a: unknown[]) => {
      calls.push(['upsert', ...a])
      return undefined as never
    },
    removeJobScheduler: async (id: string) => {
      calls.push(['remove', id])
      return true
    },
    add: async (...a: unknown[]) => {
      calls.push(['add', ...a])
      return undefined as never
    },
  }
}

/** Old per-sweep queues: `next` is when their scheduler would have run next (none: no scheduler). */
function legacyQueues(next: Record<string, number | undefined>, busy: string[] = []) {
  const calls: string[] = []
  const make = (name: string) => ({
    getJobScheduler: async (id: string) => {
      calls.push(`${name} read ${id}`)
      const n = next[name]
      return (n === undefined ? undefined : { key: id, name: id, next: n }) as never
    },
    removeJobScheduler: async (id: string) => {
      calls.push(`${name} remove ${id}`)
      return true
    },
    obliterate: async (opts?: { force?: boolean }) => {
      if (busy.includes(name) && !opts?.force)
        throw new Error('Cannot obliterate queue with active jobs')
      calls.push(`${name} obliterate${opts?.force ? ' force' : ''}`)
    },
    close: async () => {
      calls.push(`${name} close`)
    },
  })
  return { calls, make }
}

const sweep = (over: Partial<Sweep> & Pick<Sweep, 'name'>): Sweep => ({
  schedule: { every: 60_000 },
  run: async () => ({ ok: 1 }),
  legacy: { queue: `{old}-${over.name}`, scheduler: `old-${over.name}` },
  ...over,
})

describe('runSweep', () => {
  it('runs the sweep the job names and returns its result', async () => {
    const byName = new Map([['a', { run: async () => ({ done: 3 }) }]])
    expect(await runSweep(byName, new Set(), 'a')).toEqual({ done: 3 })
  })

  it('skips a run while the same sweep is still going, then runs again once it ends', async () => {
    let release = () => {}
    let runs = 0
    const byName = new Map([
      [
        'slow',
        {
          run: () => {
            runs += 1
            return new Promise<unknown>((r) => {
              release = () => r({ ok: 1 })
            })
          },
        },
      ],
    ])
    const running = new Set<string>()
    const first = runSweep(byName, running, 'slow')
    expect(await runSweep(byName, running, 'slow')).toEqual({ skipped: 1 })
    release()
    expect(await first).toEqual({ ok: 1 })
    expect(running.size).toBe(0)
    const third = runSweep(byName, running, 'slow')
    release()
    await third
    expect(runs).toBe(2)
  })

  it('frees the sweep after a failure so the next run is not skipped', async () => {
    const byName = new Map([
      [
        'boom',
        {
          run: async () => {
            throw new Error('db down')
          },
        },
      ],
    ])
    const running = new Set<string>()
    await expect(runSweep(byName, running, 'boom')).rejects.toThrow('db down')
    expect(running.has('boom')).toBe(false)
  })

  it('a job for a sweep this build does not have does nothing', async () => {
    expect(await runSweep(new Map(), new Set(), 'gone')).toEqual({ unknown: 1 })
  })
})

describe('scheduleSweeps (first boot after the move)', () => {
  it('an every-sweep starts at its old next run, then its old queue is removed', async () => {
    const q = sharedQueue()
    const old = legacyQueues({ '{old}-a': NOW + 30_000 })
    await scheduleSweeps(q, [sweep({ name: 'a' })], old.make, { now: () => NOW })
    expect(q.calls).toEqual([
      ['upsert', 'a', { every: 60_000, startDate: NOW + 30_000 }, { name: 'a' }],
    ])
    expect(old.calls).toEqual([
      '{old}-a read old-a',
      '{old}-a remove old-a',
      '{old}-a obliterate',
      '{old}-a close',
    ])
  })

  it('with no old scheduler (later boots) the shared one is upserted as is', async () => {
    const q = sharedQueue()
    await scheduleSweeps(q, [sweep({ name: 'a' })], legacyQueues({}).make, { now: () => NOW })
    expect(q.calls).toEqual([['upsert', 'a', { every: 60_000 }, { name: 'a' }]])
  })

  it('a cron sweep keeps its pattern, and runs once now if its old run was due and not taken', async () => {
    const schedule = { pattern: '30 3 * * *', tz: 'Asia/Kolkata' }
    const due = sharedQueue()
    await scheduleSweeps(
      due,
      [sweep({ name: 'prune', schedule })],
      legacyQueues({ '{old}-prune': NOW - 5_000 }).make,
      { now: () => NOW },
    )
    expect(due.calls).toEqual([
      ['upsert', 'prune', schedule, { name: 'prune' }],
      ['add', 'prune', {}],
    ])

    const notDue = sharedQueue()
    await scheduleSweeps(
      notDue,
      [sweep({ name: 'prune', schedule })],
      legacyQueues({ '{old}-prune': NOW + 60_000 }).make,
      { now: () => NOW },
    )
    expect(notDue.calls).toEqual([['upsert', 'prune', schedule, { name: 'prune' }]])
  })

  it('a disabled sweep loses both schedules', async () => {
    const q = sharedQueue()
    const old = legacyQueues({ '{old}-cert': NOW })
    await scheduleSweeps(q, [sweep({ name: 'cert', enabled: false })], old.make, {
      now: () => NOW,
    })
    expect(q.calls).toEqual([['remove', 'cert']])
    expect(old.calls).toContain('{old}-cert remove old-cert')
  })

  it('an old queue with an active job is deleted later, by force', async () => {
    const q = sharedQueue()
    const old = legacyQueues({}, ['{old}-a'])
    await scheduleSweeps(q, [sweep({ name: 'a' })], old.make, { now: () => NOW, retryLaterMs: 1 })
    expect(old.calls).not.toContain('{old}-a obliterate')
    await new Promise((r) => setTimeout(r, 20))
    expect(old.calls).toContain('{old}-a obliterate force')
    expect(old.calls).toContain('{old}-a close')
  })

  it('one sweep failing to schedule does not stop the others', async () => {
    const q = sharedQueue()
    const upsert = q.upsertJobScheduler
    q.upsertJobScheduler = async (...a: unknown[]) => {
      if (a[0] === 'a') throw new Error('redis busy')
      return upsert(...a)
    }
    await scheduleSweeps(q, [sweep({ name: 'a' }), sweep({ name: 'b' })], legacyQueues({}).make, {
      now: () => NOW,
    })
    expect(q.calls).toEqual([['upsert', 'b', { every: 60_000 }, { name: 'b' }]])
  })
})
