import type { Metadata } from 'next'
import ActivityLogPage from '@/components/activity-log/activity-log-page'
import { activityLogContent } from '@/data/activity-log'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(activityLogContent)
  return { title: copy.title }
}

export default function Page() {
  return <ActivityLogPage />
}
