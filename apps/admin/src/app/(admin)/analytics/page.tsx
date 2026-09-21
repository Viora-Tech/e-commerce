import { BarChart3 } from 'lucide-react'
import type { Metadata } from 'next'
import { SectionEmpty } from '@/components/layout/section-empty'
import { analyticsContent } from '@/data/analytics'

export const metadata: Metadata = { title: 'Analytics' }

export default function Page() {
  return <SectionEmpty {...analyticsContent.index} icon={BarChart3} />
}
