'use client'

import {
  CheckIcon,
  ChevronsUpDown,
  ExternalLink,
  Globe,
  LayoutGrid,
  Store,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@commerce/ui/shadcn/sidebar'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { appIcon } from '@/apps/app-icons'
import { authContent } from '@/data/auth'
import {
  APPS_GROUP,
  NAV_GROUPS,
  type NavItem,
  navigationContent,
  SETTINGS_GROUP,
  SETTINGS_NAV,
} from '@/data/navigation'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { useRecentApps } from '@/hooks/use-recent-apps'
import { authClient } from '@/lib/auth-client'
import { withSalesChannels } from '@/lib/nav-channels'
import { localizeNavItems, navGroupName } from '@/lib/page-names'
import { orderSidebarApps } from '@/lib/recent-apps'
import { routes } from '@/lib/routes'
import {
  SIDEBAR_BLOCK,
  SIDEBAR_CONTROL,
  SIDEBAR_DURATION,
  SIDEBAR_LABEL,
} from '@/lib/sidebar-motion'
import MemberAvatar from './account/member-avatar'
import SidebarUsageCard, { type SidebarUsage } from './layout/sidebar-usage-card'
import UserMenu from './layout/user-menu'
import NavGroupBlock from './nav-group-block'

type StoreOption = { id: string; name: string; slug: string }

type AdminSidebarProps = {
  stores: StoreOption[]
  activeStoreId: string | null
  apps: {
    id: string
    name: string
    icon: string | null
    href: string
    /** The app's own pages (manifest pages with a nav label), nested under its row. */
    pages?: { href: string; label: string }[]
  }[]
  /** Installed sales channel apps (Inbox), listed under Sales channels. */
  channels?: string[] | undefined
  logoUrl: string | null
  user: { name: string; email: string; image: string | null }
  /** The live storefront's address; its host is the domain pill. */
  storefrontUrl: string
  bugReports: boolean
  /** Orders this month against the plan. Hidden until billing supplies it. */
  usage?: SidebarUsage | undefined
  /** Count pills on rows, by the row's href (Orders: orders waiting to ship). */
  navCounts?: Record<string, number> | undefined
}

/* Figma "Store switcher" and "User": a 48px row, 32px tile or avatar, 10px gap, radius 8. */
const ROW_TRIGGER =
  'flex h-12 w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-sm px-1.5 text-left transition-[background-color,padding] hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-sidebar-accent/60 group-data-[collapsible=icon]:px-0 ' +
  SIDEBAR_DURATION

/* Figma sidebar menus (store switcher, user menu): 240px glass, radius 8, 4px inset. */
const SIDEBAR_MENU = 'w-60 rounded-sm p-1'

/**
 * The Apps group (owner, 14 Nov 2026): the three apps this member opened most recently in this
 * store (`orderSidebarApps`, the one on screen first) as plain links, no pages nested under them
 * (each app keeps its own menu inside its page), then "View more" to every app. With no app
 * installed, the group keeps its one Apps link.
 */
function withAppRows(
  items: NavItem[],
  shown: AdminSidebarProps['apps'],
  viewMore: string,
): NavItem[] {
  if (shown.length === 0) return items
  return [
    ...shown.map((a) => ({
      href: a.href,
      label: a.name,
      icon: appIcon(a.icon),
      base: routes.apps.page(a.id),
    })),
    { href: routes.apps.list(), label: viewMore, icon: LayoutGrid },
  ]
}

/** The host of a URL for the domain pill ("waimers.in"), or the URL itself when it will not parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * The Proofly sidebar (Figma "Sidebar · Proofly"): store switcher with the key tile, the store's
 * domain, grouped sections that expand in place, the plan usage card and the member's row.
 * Collapses to an icon rail.
 */
export default function AdminSidebar({
  stores,
  activeStoreId,
  apps,
  channels = [],
  logoUrl,
  user,
  storefrontUrl,
  bugReports,
  usage,
  navCounts = {},
}: AdminSidebarProps) {
  // Hooks
  const copy = useCopy(navigationContent)
  const auth = useCopy(authContent)
  const locale = useLocale()
  const pathname = usePathname()
  const { member } = usePermissions()
  const { recent, currentId } = useRecentApps(
    activeStoreId,
    pathname,
    apps.map((a) => a.id),
  )
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  // Event handlers
  const handleSwitchStore = async (id: string) => {
    if (switchingId) return
    setSwitchingId(id)
    try {
      const { error } = await authClient.organization.setActive({ organizationId: id })
      if (error) throw new Error(error.message ?? auth.selectStore.switchFailed)
      // A full load, so client caches (permissions, lists) start fresh for the new store.
      window.location.assign(routes.home())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : auth.selectStore.switchFailed)
      setSwitchingId(null)
    }
  }

  // Render logic
  const active = stores.find((s) => s.id === activeStoreId) ?? null
  const storeName = active?.name ?? copy.pickStore
  const role = member ? (member.isOwner ? copy.storeRole.owner : member.roleName) : null
  const domain = hostOf(storefrontUrl)

  return (
    <Sidebar collapsible="icon" className="group-data-[side=left]:border-r-0">
      <SidebarHeader
        className={`gap-0.5 px-2.5 pt-3 pb-0 transition-[padding] group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2 ${SIDEBAR_DURATION}`}
      >
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={copy.switchStore} className={ROW_TRIGGER}>
            {/* The store's key tile: its logo when the theme has one, else the store glyph. */}
            <span
              aria-hidden="true"
              className={cn(
                'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm',
                logoUrl ? 'border border-hairline bg-card' : 'key-primary',
              )}
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="size-full object-contain"
                />
              ) : (
                <Store className="size-4" />
              )}
            </span>
            <span className={cn('flex min-w-0 flex-1 flex-col', SIDEBAR_LABEL)}>
              <span className="truncate text-body font-semibold text-sidebar-foreground">
                {storeName}
              </span>
              {role ? <span className="truncate text-xs text-muted-foreground">{role}</span> : null}
            </span>
            <ChevronsUpDown
              className={cn('size-4 shrink-0 text-muted-foreground', SIDEBAR_CONTROL)}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={SIDEBAR_MENU}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                {copy.stores}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {stores.map((s) => (
              <DropdownMenuItem
                key={s.id}
                aria-current={s.id === activeStoreId ? 'true' : undefined}
                disabled={switchingId !== null || s.id === activeStoreId}
                onClick={() => handleSwitchStore(s.id)}
                // The open store is marked, not dimmed: dimmed, the other store looked picked.
                className={cn(
                  s.id === activeStoreId &&
                    'bg-accent font-medium text-accent-foreground data-disabled:opacity-100',
                )}
              >
                {/* Figma "State · Switching store": the picked store spins until Home reloads. */}
                {switchingId === s.id ? <Spinner /> : <Store className="size-4" />}
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {s.id === activeStoreId ? (
                  <CheckIcon aria-hidden className="size-4 shrink-0" />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={routes.selectStore()} />}>
              {copy.allStores}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Figma "State · Domain pill hover": a link to the live store, named in a tooltip. */}
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={copy.openStoreAddress(domain)}
                className={cn(
                  'key-neutral flex h-8 items-center gap-2 rounded-sm pr-2 pl-2.5 text-[0.8125rem] leading-5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  SIDEBAR_BLOCK,
                )}
              />
            }
          >
            <Globe className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{domain}</span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {copy.openStoreAddress(domain)}
          </TooltipContent>
        </Tooltip>
      </SidebarHeader>

      <SidebarContent className="no-scrollbar gap-0.5 pt-0.5">
        {withSalesChannels(NAV_GROUPS, channels).map((group) => (
          <NavGroupBlock
            key={group.label}
            label={group.label ? navGroupName(group.label, locale) : undefined}
            items={
              group.label === APPS_GROUP
                ? withAppRows(
                    localizeNavItems(group.items, locale),
                    orderSidebarApps(apps, recent, currentId),
                    copy.viewMoreApps,
                  )
                : localizeNavItems(group.items, locale)
            }
            pathname={pathname}
            counts={navCounts}
          />
        ))}
        <NavGroupBlock
          label={navGroupName(SETTINGS_GROUP, locale)}
          items={localizeNavItems([SETTINGS_NAV], locale)}
          pathname={pathname}
          counts={navCounts}
        />
      </SidebarContent>

      <SidebarFooter
        className={`gap-0.5 px-2.5 pt-2 pb-3 transition-[padding] group-data-[collapsible=icon]:px-2 ${SIDEBAR_DURATION}`}
      >
        {usage ? <SidebarUsageCard usage={usage} /> : null}
        <UserMenu
          user={user}
          bugReports={bugReports}
          align="end"
          side="right"
          variant="sidebar"
          triggerLabel={copy.account}
          triggerClassName={`${ROW_TRIGGER} pt-2 pb-1`}
          trigger={
            <>
              <MemberAvatar
                name={user.name}
                email={user.email}
                image={user.image}
                className="size-8"
                fallbackClassName="bg-primary text-[0.8125rem] text-primary-foreground"
              />
              <span className={cn('flex min-w-0 flex-1 flex-col', SIDEBAR_LABEL)}>
                <span className="truncate text-body font-medium text-sidebar-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              <ChevronsUpDown
                className={cn('size-4 shrink-0 text-muted-foreground', SIDEBAR_CONTROL)}
              />
            </>
          }
        />
      </SidebarFooter>
    </Sidebar>
  )
}
