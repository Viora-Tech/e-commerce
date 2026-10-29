import type { Metadata } from 'next'
import ApprovalsPage from '@/components/approvals/approvals-page'
import { approvalsContent } from '@/data/approvals'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(approvalsContent)
  return { title: copy.title }
}

export default function Page() {
  return <ApprovalsPage />
}
