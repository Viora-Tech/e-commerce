import { loadEnv } from '@commerce/config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BugReportsPage from '@/components/account/bug-reports/bug-reports-page'
import { myBugReportsContent } from '@/data/bug-report'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(myBugReportsContent)
  return { title: copy.title }
}

/** Account → My reports. Only where this server takes bug reports (the test server). */
export default function Page() {
  if (!loadEnv(process.env).BUG_REPORTS_ENABLED) notFound()
  return <BugReportsPage />
}
