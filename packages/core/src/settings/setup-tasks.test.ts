/** SOURCE OF TRUTH: setup-task selection tests — which task comes next after a save */
import { describe, expect, it } from 'vitest'
import { pickNextSetup, SETUP_ITEM_IDS, type SetupItem, setupProgress } from './setup-tasks'

const items = (doneIds: string[]): SetupItem[] =>
  SETUP_ITEM_IDS.map((id) => ({ id, done: doneIds.includes(id) }))

describe('pickNextSetup', () => {
  it('returns the first undone task with no task just saved', () => {
    expect(pickNextSetup(items(['store']))).toBe('payments')
  })

  it('moves on to the task after the one just saved', () => {
    expect(pickNextSetup(items(['store', 'taxes']), 'store')).toBe('payments')
    expect(pickNextSetup(items(['store', 'payments']), 'payments')).toBe('shipping')
  })

  it('skips done tasks after the saved one', () => {
    expect(pickNextSetup(items(['store', 'payments', 'shipping', 'taxes']), 'store')).toBe('domain')
  })

  it('wraps round to an earlier undone task', () => {
    expect(
      pickNextSetup(
        items(['payments', 'shipping', 'taxes', 'domain', 'notifications']),
        'policies',
      ),
    ).toBe('store')
  })

  it('can return the saved task itself when it is the only one left', () => {
    expect(pickNextSetup(items(SETUP_ITEM_IDS.filter((i) => i !== 'domain')), 'domain')).toBe(
      'domain',
    )
  })

  it('returns null once everything is done', () => {
    expect(pickNextSetup(items([...SETUP_ITEM_IDS]), 'store')).toBeNull()
  })
})

describe('setupProgress', () => {
  it('counts done tasks and names the next one', () => {
    expect(setupProgress(items(['store', 'payments']), 'payments')).toMatchObject({
      done: 2,
      total: SETUP_ITEM_IDS.length,
      next: 'shipping',
    })
  })
})
