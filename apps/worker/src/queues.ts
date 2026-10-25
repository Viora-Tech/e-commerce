import { HEARTBEAT_QUEUE, type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

export { createConnection, HEARTBEAT_QUEUE } from '@commerce/queue'

export function createHeartbeat(connection: IORedis) {
  const queue = new Queue(HEARTBEAT_QUEUE, { connection })
  const worker = new Worker(
    HEARTBEAT_QUEUE,
    async () => {
      // Nothing to do: the job's wide event (`logWorkerJobs`) is the heartbeat.
    },
    { connection, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
