import { Globe } from 'lucide-react'
import type { Metadata } from 'next'
import { SectionEmpty } from '@/components/layout/section-empty'
import { settingsContent } from '@/data/settings'

export const metadata: Metadata = { title: 'Domains' }

export default function Page() {
  return <SectionEmpty {...settingsContent.domains} icon={Globe} />
}
