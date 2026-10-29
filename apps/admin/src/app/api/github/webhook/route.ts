import { loadEnv } from '@commerce/config'
import {
  bugReportSyncDeps,
  checkRateLimit,
  createMemoryRateLimitStore,
  handleGithubWebhook,
  type RateLimitRule,
  storeNotificationChannels,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { logger } from '@commerce/observability/logging'
import { db } from '@/lib/db'

/** GitHub sends a burst on a release (push + pull request + issue closes); this is far above it. */
const WEBHOOK_RULE: RateLimitRule = { limit: 300, windowMs: 60_000 }
const limiter = createMemoryRateLimitStore()

/** Recent delivery ids: GitHub's "Redeliver" and its own retries repeat one; skip the repeat. */
const SEEN_MAX = 500
const seen = new Set<string>()

function remember(id: string): void {
  seen.add(id)
  if (seen.size > SEEN_MAX) {
    const oldest = seen.values().next().value
    if (oldest !== undefined) seen.delete(oldest)
  }
}

/**
 * GitHub → "Report a bug" statuses (Account → My reports). The repository's webhook sends
 * Issues, Issue comments, Pushes and Pull requests here, signed with GITHUB_WEBHOOK_SECRET
 * (`X-Hub-Signature-256`); anything unsigned is refused. Unset secret: 404. Developer docs:
 * Operations > Bug reports.
 */
export async function POST(request: Request) {
  const env = loadEnv(process.env)
  if (!env.GITHUB_WEBHOOK_SECRET) return new Response('Not found', { status: 404 })
  const limit = await checkRateLimit(limiter, 'github-webhook', WEBHOOK_RULE)
  if (!limit.ok) return new Response('Too many requests', { status: 429 })

  const rawBody = await request.text()
  const event = request.headers.get('x-github-event') ?? ''
  const deliveryId = request.headers.get('x-github-delivery')
  if (deliveryId && seen.has(deliveryId)) return Response.json({ ok: true, duplicate: true })
  const outcome = await handleGithubWebhook(
    db(),
    { event, rawBody, signature: request.headers.get('x-hub-signature-256') },
    {
      secret: env.GITHUB_WEBHOOK_SECRET,
      repo: env.GITHUB_ISSUES_REPO,
      deps: bugReportSyncDeps({
        token: env.GITHUB_ISSUES_TOKEN,
        repo: env.GITHUB_ISSUES_REPO,
        adminUrl: env.ADMIN_URL,
        // The reporter's WhatsApp goes through the store's own WhatsApp channel.
        storeChannels: async (tx, storeId) =>
          storeNotificationChannels(tx, storeId, {
            registry: (await registriesForStore(tx, storeId)).notifications,
            settingsSecret: env.SETTINGS_SECRET,
          }),
      }),
    },
  )
  // Only a signed, applied delivery counts as seen, so a forged id cannot block the real one.
  if (outcome.ok && deliveryId) remember(deliveryId)
  if (!outcome.ok) {
    return new Response(outcome.reason === 'bad_signature' ? 'Bad signature' : 'Bad JSON', {
      status: outcome.reason === 'bad_signature' ? 401 : 400,
    })
  }
  if (outcome.updated > 0) {
    logger.info('bug reports synced from github', {
      area: 'bug-reports',
      event,
      change: outcome.change,
      updated: outcome.updated,
      notified: outcome.notified,
    })
  }
  return Response.json(outcome)
}
