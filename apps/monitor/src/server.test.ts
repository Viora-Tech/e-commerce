import { describe, expect, it } from 'vitest'
import {
  CPU_FRESH,
  CPU_HOT_READINGS,
  CPU_QUIET_MS,
  type CpuState,
  nextCpuState,
  readServerAlert,
  sameCpuState,
  serverAlertSubject,
  serverAlertText,
} from './server'

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 20, 12, minutes)).toISOString()

/** The body that sent "CPU at 140% on vextro-app" while the box was ~50% busy. */
const REPORTED = {
  title: 'CPU at 140% on vextro-app',
  server: 'koomerce-app',
  cpu: '140%',
  memory: '56%',
  disk: '33%',
  threshold: '85%',
}

describe('readServerAlert', () => {
  it('divides the summed CPU by the cores from the env', () => {
    expect(readServerAlert(REPORTED, '2')).toMatchObject({
      kind: 'CPU',
      server: 'koomerce-app',
      cpuRaw: 140,
      cores: 2,
      cpu: 70,
      memory: 56,
      disk: 33,
      threshold: 85,
    })
  })

  it('prefers the core count in the payload, and falls back to 2', () => {
    expect(readServerAlert({ ...REPORTED, cores: 4 }, '2')?.cpu).toBe(35)
    expect(readServerAlert(REPORTED)?.cores).toBe(2)
    expect(readServerAlert(REPORTED, 'nonsense')?.cores).toBe(2)
  })

  it('leaves other Dokploy notifications alone', () => {
    expect(readServerAlert({ title: 'Build failed', applicationName: 'admin' })).toBeNull()
  })

  it('names the server, not the hostname, in the subject', () => {
    const reading = readServerAlert({ ...REPORTED, cpu: '180%' }, '2')
    expect(reading && serverAlertSubject(reading)).toBe('CPU at 90% on koomerce-app')
    expect(reading && serverAlertText(reading)).toContain('cpu: 90% (180% of 2 cores)')
    const memory = readServerAlert({
      ...REPORTED,
      title: 'Memory at 91% on vextro-app',
      memory: '91%',
    })
    expect(memory && serverAlertSubject(memory)).toBe('Memory at 91% on koomerce-app')
  })
})

describe('nextCpuState', () => {
  const run = (readings: Array<[minute: number, hot: boolean]>, start: CpuState = CPU_FRESH) => {
    let state = start
    const alerts: number[] = []
    for (const [minute, hot] of readings) {
      const next = nextCpuState(state, hot, at(minute))
      state = next.state
      if (next.alert) alerts.push(minute)
    }
    return { state, alerts }
  }

  it('one hot reading is not an alert', () => {
    expect(run([[0, true]]).alerts).toEqual([])
  })

  it(`alerts once CPU is hot for ${CPU_HOT_READINGS} readings in a row`, () => {
    expect(
      run([
        [0, true],
        [5, true],
        [10, true],
      ]).alerts,
    ).toEqual([10])
  })

  it('a cool reading or a missed run breaks the streak', () => {
    expect(
      run([
        [0, true],
        [5, false],
        [10, true],
        [15, true],
      ]).alerts,
    ).toEqual([])
    expect(
      run([
        [0, true],
        [5, true],
        [20, true],
        [25, true],
      ]).alerts,
    ).toEqual([])
  })

  it('stays quiet for an hour after an alert, then needs a new streak', () => {
    const hot = Array.from({ length: 20 }, (_, i): [number, boolean] => [i * 5, true])
    const { alerts } = run(hot)
    expect(alerts).toEqual([10, 10 + CPU_QUIET_MS / 60_000 + 10])
  })

  it('writes nothing while CPU is cool or during the quiet hour', () => {
    expect(sameCpuState(CPU_FRESH, nextCpuState(CPU_FRESH, false, at(0)).state)).toBe(true)
    const { state } = run([
      [0, true],
      [5, true],
      [10, true],
    ])
    expect(sameCpuState(state, nextCpuState(state, true, at(15)).state)).toBe(true)
    expect(sameCpuState(state, nextCpuState(state, false, at(15)).state)).toBe(true)
  })
})
