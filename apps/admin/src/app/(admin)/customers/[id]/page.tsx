import { UserRound } from 'lucide-react'
import type { Metadata } from 'next'
import { SectionEmpty } from '@/components/layout/section-empty'
import { customersContent } from '@/data/customers'

export const metadata: Metadata = { title: 'Customer' }

/** Customer records arrive with the customers module; until then any id resolves to this. */
export default function Page() {
  return <SectionEmpty {...customersContent.detail} icon={UserRound} />
}
