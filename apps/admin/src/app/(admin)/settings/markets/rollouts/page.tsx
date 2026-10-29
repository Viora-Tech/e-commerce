import type { Metadata } from 'next'
import RolloutsList from '@/components/settings/rollouts/rollouts-list'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Rollouts' }

export default async function Page() {
  const context = await serverContext()
  const rollouts = await call(
    appRouter.rollouts.list,
    { statuses: ['active', 'paused', 'scheduled', 'draft', 'ended'] },
    { context },
  )
  return <RolloutsList rollouts={rollouts} />
}
