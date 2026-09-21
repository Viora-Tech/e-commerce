import { SlidersHorizontal } from 'lucide-react'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { onlineStoreContent } from '@/data/online-store'

export const metadata: Metadata = { title: 'Preferences' }

export default function Page() {
  return <SectionEmpty {...onlineStoreContent.preferences} icon={SlidersHorizontal} />
}
