import { Users } from 'lucide-react'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import { customersContent } from '@/data/customers'

export const metadata: Metadata = { title: 'Customers' }

export default function Page() {
  return <SectionEmpty {...customersContent.index} icon={Users} />
}
