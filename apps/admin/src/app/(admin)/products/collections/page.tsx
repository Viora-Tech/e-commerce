import { LayoutGrid } from 'lucide-react'
import type { Metadata } from 'next'
import { SectionEmpty } from '@/components/layout/section-empty'
import { productsSectionsContent } from '@/data/products'

export const metadata: Metadata = { title: 'Collections' }

export default function Page() {
  return <SectionEmpty {...productsSectionsContent.collections} icon={LayoutGrid} />
}
