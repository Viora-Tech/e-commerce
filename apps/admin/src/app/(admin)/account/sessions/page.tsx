import type { Metadata } from 'next'
import SessionsPage from '@/components/account/sessions-page'
import { accountContent } from '@/data/account'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(accountContent)
  return { title: copy.sessions.title }
}

export default function Page() {
  return <SessionsPage />
}
