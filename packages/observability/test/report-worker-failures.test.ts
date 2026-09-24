import { describe, expect, it, vi } from 'vitest'
import { reportWorkerFailures } from '../src/report-worker-failures'

type Listener = (job: unknown, error: Error) => void

function fakeWorker() {
  const listeners: Listener[] = []
  return {
    emit(job: unknown, error: Error) {
      for (const l of listeners) l(job, error)
    },
    on: (_event: 'failed', listener: Listener) => {
      listeners.push(listener)
    },
  }
}

describe('reportWorkerFailures', () => {
  it('tags the queue name and job name, without the job payload', () => {
    const worker = fakeWorker()
    const report = vi.fn()
    reportWorkerFailures(worker, 'notifications', report)

    const error = new Error('boom')
    worker.emit({ name: 'send-order-placed', data: { storeId: 'store_1', to: 'a@b.com' } }, error)

    expect(report).toHaveBeenCalledWith(error, {
      queue: 'notifications',
      jobName: 'send-order-placed',
      storeId: 'store_1',
    })
  })

  it('omits storeId when the job has none, and still reports', () => {
    const worker = fakeWorker()
    const report = vi.fn()
    reportWorkerFailures(worker, 'heartbeat', report)

    worker.emit({ name: 'tick', data: {} }, new Error('boom'))

    expect(report).toHaveBeenCalledWith(new Error('boom'), { queue: 'heartbeat', jobName: 'tick' })
  })

  it('reports even without a job', () => {
    const worker = fakeWorker()
    const report = vi.fn()
    reportWorkerFailures(worker, 'domains', report)

    worker.emit(undefined, new Error('boom'))

    expect(report).toHaveBeenCalledWith(new Error('boom'), { queue: 'domains', jobName: 'unknown' })
  })
})
