import { loadEnv } from '@commerce/config'
import { Palette } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import ThemeEditor from '@/components/themes/theme-editor'
import { themesContent } from '@/data/themes'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Themes' }

export default async function Page() {
  const context = await serverContext()
  const loaded = await call(appRouter.store.getTheme, undefined, { context }).catch(() => null)

  if (!loaded) return <SectionEmpty {...themesContent.unavailable} icon={Palette} />
  return (
    <ThemeEditor
      theme={loaded.theme}
      previewToken={loaded.previewToken}
      storefrontOrigin={new URL(loadEnv(process.env).STOREFRONT_URL).origin}
    />
  )
}
