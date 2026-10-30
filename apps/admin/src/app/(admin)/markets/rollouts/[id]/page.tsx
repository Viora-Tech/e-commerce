import { notFound, redirect } from 'next/navigation'
import RolloutForm from '@/components/rollouts/rollout-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'
import { loadRolloutPage } from '../load'

type Params = { params: Promise<{ id: string }> }

/** A missing rollout (another store's, or a malformed id) is a 404, not an error page. */
const missing = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') return null
  return orNoStore(undefined)(error)
}

export default async function RolloutPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const rollout = await call(appRouter.rollouts.get, { id }, { context }).catch(missing)
  if (rollout === undefined) redirect(routes.selectStore())
  if (!rollout) notFound()
  const [data, results] = await Promise.all([
    loadRolloutPage(context),
    // An A/B test's numbers per arm; null for a rollout without a test.
    rollout.audience ? call(appRouter.rollouts.results, { id }, { context }) : null,
  ])
  return (
    <RolloutForm
      key={`${rollout.id}-${rollout.status}-${rollout.endsAt?.toISOString() ?? ''}`}
      rollout={rollout}
      data={data}
      results={results}
    />
  )
}
