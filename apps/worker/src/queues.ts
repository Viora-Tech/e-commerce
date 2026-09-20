import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

export const HEARTBEAT_QUEUE = '{system}-heartbeat'

export function createConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null })
}

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
