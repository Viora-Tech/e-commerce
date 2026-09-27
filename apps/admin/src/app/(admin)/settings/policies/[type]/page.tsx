import { loadEnv } from '@commerce/config'
import { isPolicyType, POLICY_TITLES } from '@commerce/core/policies'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PolicyEditor from '@/components/settings/policy-editor'

type PageProps = {
  params: Promise<{ type: string }>
  searchParams: Promise<{ template?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type } = await params
  return { title: isPolicyType(type) ? POLICY_TITLES[type] : 'Policies' }
}

export default async function Page({ params, searchParams }: PageProps) {
  const { type } = await params
  if (!isPolicyType(type)) notFound()
  const { template } = await searchParams
  return (
    <PolicyEditor
      type={type}
      startFromTemplate={template === '1'}
      storefrontOrigin={loadEnv(process.env).STOREFRONT_URL}
    />
  )
}
