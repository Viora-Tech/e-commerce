import type { Metadata } from 'next'
import StoresPage from '@/components/account/stores-page'
import { accountContent } from '@/data/account'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(accountContent)
  return { title: copy.stores.title }
}

export default function Page() {
  return <StoresPage />
}
