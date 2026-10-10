'use client'

import { siteConfig } from '@commerce/config/site'
import {
  AiIcon,
  editorGlyphs,
  HelpCircle,
  ImageIcon,
  Layers,
  Palette,
  Plus,
  Settings,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import type { ReactElement, ReactNode } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS, CHROME_TRANSITION } from '@/lib/customize-chrome'

export type RailPanel =
  | 'add'
  | 'ai'
  | 'pages'
  | 'sections'
  | 'media'
  | 'theme'
  | 'settings'
  | 'help'

type CustomizeRailProps = {
  active: RailPanel
  onChange: (panel: RailPanel) => void
  /** The store's logo for the tile at the top; its first letter when it has none. */
  store: { name: string; logoUrl: string | null }
}

/** In the Figma rail's order (369:4864): add, AI, pages, layers, media, theme, settings. */
const ITEMS: { panel: RailPanel; icon: typeof Plus }[] = [
  { panel: 'add', icon: Plus },
  { panel: 'ai', icon: AiIcon },
  { panel: 'pages', icon: editorGlyphs.page },
  { panel: 'sections', icon: Layers },
  { panel: 'media', icon: ImageIcon },
  { panel: 'theme', icon: Palette },
  { panel: 'settings', icon: Settings },
]

/** The editor's page in the merchant guide, behind the rail's help button. */
export const EDITOR_HELP_URL = `${siteConfig.urls.docs}/merchant-guide/online-store/website-builder`

const ITEM = cn(
  'flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-5',
  CHROME_TRANSITION,
  CHROME_FOCUS,
)

/**
 * The far-left icon rail (Figma 369:4864): the store's tile on top, the panels in the middle,
 * help pinned to the bottom. Each button names itself in a tooltip on the right.
 */
export default function CustomizeRail({ active, onChange, store }: CustomizeRailProps) {
  // Hooks
  const copy = useCopy(customizeContent.rail)

  // Render logic
  const initial = (store.name.charAt(0) || siteConfig.brand.name.charAt(0)).toUpperCase()

  return (
    <nav
      aria-label={copy.label}
      className="flex w-16 shrink-0 flex-col items-center gap-3 border-r border-border bg-card py-4"
    >
      <span
        aria-hidden
        className="key-primary flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[0.5625rem] text-caption font-semibold"
      >
        {store.logoUrl ? (
          // biome-ignore lint/performance/noImgElement: the store's own small logo, from any host.
          <img src={store.logoUrl} alt="" className="size-full bg-card object-contain p-0.5" />
        ) : (
          initial
        )}
      </span>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        {ITEMS.map(({ panel, icon: Icon }) => (
          <RailTip
            key={panel}
            label={copy[panel]}
            trigger={
              <button
                type="button"
                onClick={() => onChange(panel)}
                aria-label={copy[panel]}
                aria-current={active === panel ? 'true' : undefined}
                className={cn(
                  ITEM,
                  active === panel &&
                    'bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary',
                )}
              />
            }
          >
            <Icon aria-hidden weight="regular" />
          </RailTip>
        ))}
      </div>
      <RailTip
        label={copy.help}
        trigger={
          <button
            type="button"
            onClick={() => onChange('help')}
            aria-label={copy.help}
            aria-current={active === 'help' ? 'true' : undefined}
            className={cn(
              ITEM,
              active === 'help' &&
                'bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary',
            )}
          />
        }
      >
        <HelpCircle aria-hidden weight="regular" />
      </RailTip>
    </nav>
  )
}

/** A rail button with its name in a tooltip to the right. */
function RailTip({
  label,
  trigger,
  children,
}: {
  label: string
  trigger: ReactElement
  children: ReactNode
}) {
  // Render logic
  return (
    <Tooltip>
      <TooltipTrigger render={trigger}>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
