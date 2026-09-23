import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DomainDetail from '@/components/domains/domain-detail'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Domain' }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const domains = await call(appRouter.domains.list, undefined, { context })
  const domain = domains.find((d) => d.id === id)
  if (!domain) notFound()
  const primary = domains.find((d) => d.isPrimary)

  return (
    <DomainDetail key={domain.id} initial={domain} primaryHostname={primary?.hostname ?? null} />
  )
}
