import { permissions } from '@commerce/core'
import { TEMPLATE_KINDS, TEMPLATE_SUFFIX, type TemplateKind } from '@commerce/core/theme'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import CustomizeEditor from '@/components/themes/customize/customize-editor'
import ThemePacksProvider from '@/components/themes/customize/theme-packs-provider'
import { appRouter, call, serverContext } from '@/lib/api'
import { auth, getSession } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { storefrontOrigin } from '@/lib/storefront-origin'

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
  const session = await getSession()
  if (!session) redirect(routes.login())
  const context = await serverContext()
  const [theme, me, apps, themes, aiStatus, orgs] = await Promise.all([
    call(appRouter.themes.get, { id }, { context }).catch(() => null),
    call(appRouter.staff.me, {}, { context }).catch(() => null),
    call(appRouter.apps.list, undefined, { context }).catch(() => []),
    call(appRouter.themes.list, undefined, { context }).catch(() => []),
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
    auth()
      .api.listOrganizations({ headers: await headers() })
      .catch(() => []),
  ])

  if (!theme) notFound()
  const activeId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null
  const active = orgs.find((o) => o.id === activeId) ?? null
  const origin = await storefrontOrigin()
  // The rail's tile reuses the live theme's logo, like the admin sidebar's brand mark.
  const logoUrl = themes.find((t) => t.role === 'main')?.settings.brand.logo?.url ?? null
  const canPublish =
    me?.isOwner === true || (me?.permissions ?? []).includes(permissions.ONLINE_STORE_PUBLISH)
  return (
    // This theme's section packs: which pack sections (Zero Drift…) the editor offers.
    <ThemePacksProvider themeId={theme.id} packs={theme.packs}>
      <CustomizeEditor
        theme={theme}
        origin={origin}
        canPublish={canPublish}
        store={{
          id: active?.id ?? null,
          name: active?.name ?? '',
          domain: new URL(origin).host,
          logoUrl,
        }}
        user={{ name: session.user.name, email: session.user.email }}
        ai={{ connected: aiStatus?.configured === true, assistant: aiStatus?.assistant === true }}
        liveName={themes.find((t) => t.role === 'main' && t.id !== theme.id)?.name ?? null}
        installedApps={apps.filter((a) => a.installed).map((a) => a.id)}
        initial={{
          template: isKind(query.template) ? query.template : 'home',
          suffix: query.suffix && TEMPLATE_SUFFIX.test(query.suffix) ? query.suffix : '',
          resource:
            query.resource && /^[0-9a-f-]{36}$/.test(query.resource) ? query.resource : null,
        }}
      />
    </ThemePacksProvider>
  )
}
