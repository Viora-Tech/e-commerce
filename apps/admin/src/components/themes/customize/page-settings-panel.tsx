'use client'

import type { TemplateKey } from '@commerce/core/theme'
import { ExternalLink } from '@commerce/ui/icons'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import type { ResourceKind } from '@/lib/customize-resource'
import { routes } from '@/lib/routes'
import HomePageSettings from './home-page-settings'
import MoreSettings from './more-settings'
import StoreSettingsPanel from './store-settings-panel'

type PageSettingsPanelProps = {
  /** The open template. */
  template: TemplateKey
  /** Its name ("Home page", "Products"). */
  templateLabel: string
  /** The store's web address. */
  domain: string
  /** For product, collection and page templates: the one previewed on the canvas, if any. */
  resource: { kind: ResourceKind; id: string | null; title: string | null } | null
  onOpenTheme: () => void
}

const LINK = `flex w-fit items-center gap-1 rounded-sm text-[0.8125rem] leading-[1.1875rem] font-medium text-link hover:underline ${CHROME_FOCUS}`

type SharedKind = ResourceKind | 'blog' | 'article'

/** Where each kind's own pages are edited: one (the previewed one) and the list of all. */
const KIND_ROUTES: Record<SharedKind, { one?: (id: string) => string; all: () => string }> = {
  product: { one: routes.products.detail, all: routes.products.list },
  collection: { one: routes.products.collection, all: routes.products.collections },
  page: { one: routes.onlineStore.page, all: routes.onlineStore.pages },
  blog: { all: routes.content.blogs },
  article: { all: routes.content.blogPosts },
}

const sharedKindOf = (template: TemplateKey): SharedKind | null =>
  template in KIND_ROUTES ? (template as SharedKind) : null

/**
 * The rail's Page settings tab (Figma 381:7763). The home page gets the real form
 * (`HomePageSettings`). A product, collection, page, blog or blog post template is shared by
 * every one of them, so it says where each one's title, address and listing are set, with a
 * link to the one on the canvas; the other pages (cart, search, 404) have none of their own.
 * "Store-wide settings" folds open the store settings the theme shows.
 */
export default function PageSettingsPanel({
  template,
  templateLabel,
  domain,
  resource,
  onOpenTheme,
}: PageSettingsPanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.pageSettings)

  // Render logic
  const shared = sharedKindOf(template)
  const kind = shared ? copy.resource[shared] : null
  const links = shared ? KIND_ROUTES[shared] : null
  const one = resource?.id && resource.title && links?.one ? links.one(resource.id) : null

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      {template === 'home' ? (
        <HomePageSettings title={templateLabel} domain={domain} />
      ) : kind && links ? (
        <div className="flex flex-col gap-2 rounded-[0.625rem] bg-muted p-3">
          {resource?.title ? (
            <p className="text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground">
              {copy.previewing(resource.title)}
            </p>
          ) : null}
          <p className="text-xs leading-[1.0625rem] text-muted-foreground">
            {copy.resourceBody(kind)}
          </p>
          {one && resource?.title ? (
            <a href={one} target="_blank" rel="noreferrer" className={LINK}>
              {copy.editResource(resource.title)}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          ) : null}
          <a href={links.all()} target="_blank" rel="noreferrer" className={LINK}>
            {copy.allResources(kind)}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </div>
      ) : (
        <p className="rounded-[0.625rem] bg-muted p-3 text-xs leading-[1.0625rem] text-muted-foreground">
          {copy.fixedBody}
        </p>
      )}
      <MoreSettings label={copy.storeWide}>
        <div className="-mx-4">
          <StoreSettingsPanel onOpenTheme={onOpenTheme} />
        </div>
      </MoreSettings>
    </div>
  )
}
