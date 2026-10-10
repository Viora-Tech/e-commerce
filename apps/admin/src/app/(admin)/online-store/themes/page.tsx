import { SECTION_CATEGORIES } from '@commerce/blocks/puck'
import { permissions } from '@commerce/core'
import { Palette } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import ThemesLibrary from '@/components/themes/themes-library'
import { themesContent } from '@/data/themes'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Themes' }

/** Build-your-own containers and elements are not sections; every other category is. */
const NOT_SECTIONS = new Set(['layout', 'elements'])

/** How many sections the Add panel offers our own themes ("114 sections ready to use"). */
const SECTION_COUNT = new Set(
  Object.entries(SECTION_CATEGORIES).flatMap(([id, c]) =>
    NOT_SECTIONS.has(id) ? [] : [...c.components],
  ),
).size

export default async function Page() {
  const context = await serverContext()
  const [themes, me] = await Promise.all([
    call(appRouter.themes.list, undefined, { context }).catch(() => null),
    call(appRouter.staff.me, {}, { context }).catch(() => null),
  ])

  if (!themes) return <SectionEmpty {...themesContent.unavailable} icon={Palette} />
  const canPublish =
    me?.isOwner === true || (me?.permissions ?? []).includes(permissions.ONLINE_STORE_PUBLISH)
  return (
    <ThemesLibrary
      initial={themes}
      origin={await storefrontOrigin()}
      canPublish={canPublish}
      sectionCount={SECTION_COUNT}
    />
  )
}
