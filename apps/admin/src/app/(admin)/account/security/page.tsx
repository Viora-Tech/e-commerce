import type { Metadata } from 'next'
import SecurityPage from '@/components/account/security-page'
import { accountContent } from '@/data/account'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(accountContent)
  return { title: copy.security.title }
}

export default function Page() {
  return <SecurityPage />
}
