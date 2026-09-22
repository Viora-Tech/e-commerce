import { FileBarChart } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { analyticsContent } from '@/data/analytics'

export const metadata: Metadata = { title: 'Reports' }

export default function Page() {
  return <SectionEmpty {...analyticsContent.reports} icon={FileBarChart} />
}
