import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ThemeCodeEditor from '@/components/themes/code/theme-code-editor'
import { appRouter, call, serverContext } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Edit code' }

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ file?: string }>
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params
  const { file } = await searchParams
  const session = await getSession()
  if (!session) redirect(routes.login())
  const context = await serverContext()
  const theme = await call(appRouter.themes.get, { id }, { context }).catch(() => null)
  if (!theme) notFound()
  return (
    <ThemeCodeEditor
      theme={{ id: theme.id, name: theme.name, role: theme.role, previewToken: theme.previewToken }}
      origin={await storefrontOrigin()}
      me={session.user.name || session.user.email}
      initialFile={file && file.length <= 300 ? file : null}
    />
  )
}
