import type { Metadata } from 'next'
import AccountSettings from '@/components/settings/account-settings'
import { accountContent } from '@/data/account'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(accountContent)
  return { title: copy.title }
}

export default function Page() {
  return <AccountSettings />
}
