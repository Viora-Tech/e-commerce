import {
  INBOX_AI_QUEUE,
  type InboxAiJob,
  publishInboxEvents,
  runInboxAiReply,
} from '@commerce/core/inbox/server'
import type { Db } from '@commerce/db'
import {
  fairProcessor,
  type IORedis,
  KEEP_FINISHED,
  QUEUE_LIMITS,
  Queue,
  Worker,
} from '@commerce/queue'

/**
 * Inbox AI agent: one job per shopper message (the storefront's send action queues it). The
 * runner decides whether the AI answers (mode, staff online, hand-off, staff take-over), then
 * answers from the store's data or hands the chat to a person; this worker sends the realtime
 * events the run returns, so the widget and the staff inbox update without a refresh. Fair per
 * store (`QUEUE_LIMITS.inboxAi`). A failed model call is retried twice; the job id is the
 * message's, so a repeat never answers twice (the reply's client id is unique too).
 */
export function createInboxAiReplyWorker(connection: IORedis, db: Db) {
  const queue = new Queue<InboxAiJob>(INBOX_AI_QUEUE, { connection })
  const worker = new Worker<InboxAiJob>(
    INBOX_AI_QUEUE,
    fairProcessor(connection, INBOX_AI_QUEUE, QUEUE_LIMITS.inboxAi, async (job) => {
      const result = await runInboxAiReply({ db, job: job.data })
      if (result.done !== 'skipped') await publishInboxEvents(connection, result.events)
      return result.done === 'skipped' ? `skipped: ${result.why}` : result.done
    }),
    { connection, concurrency: QUEUE_LIMITS.inboxAi.concurrency, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
