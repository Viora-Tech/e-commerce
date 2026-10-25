import type { Metadata } from 'next'
import LanguageRegionPage from '@/components/account/language-region-page'
import { accountContent } from '@/data/account'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(accountContent)
  return { title: copy.language.title }
}

export default function Page() {
  return <LanguageRegionPage />
}
