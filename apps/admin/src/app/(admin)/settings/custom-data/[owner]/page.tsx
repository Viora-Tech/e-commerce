import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CustomDataOwnerPage from '@/components/metaobjects/custom-data-owner-page'
import { ownerBySlug } from '@/data/custom-data'
import { customDataContent } from '@/data/metaobjects'

type Props = { params: Promise<{ owner: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = ownerBySlug((await params).owner)
  return { title: found ? customDataContent.tabs[found.tab].label : customDataContent.title }
}

export default async function Page({ params }: Props) {
  const found = ownerBySlug((await params).owner)
  if (!found) notFound()
  return <CustomDataOwnerPage key={found.owner} owner={found.owner} tab={found.tab} />
}
