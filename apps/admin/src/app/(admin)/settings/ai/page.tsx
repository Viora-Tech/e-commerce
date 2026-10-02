import type { Metadata } from 'next'
import AiSettings from '@/components/settings/ai-settings'
import { aiContent } from '@/data/ai'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(aiContent)
  return { title: copy.settings.title }
}

export default function Page() {
  return <AiSettings />
}
