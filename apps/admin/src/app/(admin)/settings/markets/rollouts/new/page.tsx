import type { Metadata } from 'next'
import RolloutForm from '@/components/settings/rollouts/rollout-form'
import { serverContext } from '@/lib/api'
import { loadRolloutPage } from '../load'

export const metadata: Metadata = { title: 'Create rollout' }

export default async function NewRolloutPage() {
  const context = await serverContext()
  return <RolloutForm rollout={null} data={await loadRolloutPage(context)} />
}
