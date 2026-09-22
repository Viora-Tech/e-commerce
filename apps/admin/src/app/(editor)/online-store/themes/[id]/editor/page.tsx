import { permissions } from '@commerce/core'
import { TEMPLATE_KINDS, TEMPLATE_SUFFIX, type TemplateKind } from '@commerce/core/theme'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CustomizeEditor from '@/components/themes/customize/customize-editor'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Customize theme' }

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ template?: string; suffix?: string; resource?: string }>
}

const isKind = (value: string | undefined): value is TemplateKind =>
  (TEMPLATE_KINDS as readonly string[]).includes(value ?? '')

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params
  const query = await searchParams
  const context = await serverContext()
  const [theme, me] = await Promise.all([
    call(appRouter.themes.get, { id }, { context }).catch(() => null),
    call(appRouter.staff.me, {}, { context }).catch(() => null),
  ])

  if (!theme) notFound()
  const canPublish =
    me?.isOwner === true || (me?.permissions ?? []).includes(permissions.ONLINE_STORE_PUBLISH)
  return (
    <CustomizeEditor
      theme={theme}
      canPublish={canPublish}
      initial={{
        template: isKind(query.template) ? query.template : 'home',
        suffix: query.suffix && TEMPLATE_SUFFIX.test(query.suffix) ? query.suffix : '',
        resource: query.resource && /^[0-9a-f-]{36}$/.test(query.resource) ? query.resource : null,
      }}
    />
  )
}
