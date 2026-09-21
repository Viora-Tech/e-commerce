import { HEARTBEAT_QUEUE, type IORedis, Queue, Worker } from '@commerce/queue'

export { createConnection, HEARTBEAT_QUEUE } from '@commerce/queue'

export function createHeartbeat(connection: IORedis) {
  const queue = new Queue(HEARTBEAT_QUEUE, { connection })
  const worker = new Worker(
    HEARTBEAT_QUEUE,
    async (job) => {
      console.log(`[heartbeat] job ${job.id} at ${new Date().toISOString()}`)
    },
    { connection },
  )
  return { queue, worker }
}
