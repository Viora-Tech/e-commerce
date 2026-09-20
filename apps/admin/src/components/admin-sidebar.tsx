'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@commerce/ui/shadcn/sidebar'
import { ChevronsUpDown, LayoutDashboard, LogOut, Package, Palette, Store } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/theme', label: 'Theme', icon: Palette },
]

type StoreOption = { id: string; name: string; slug: string }

export function AdminSidebar({
  user,
  stores,
  activeStoreId,
}: {
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const active = stores.find((s) => s.id === activeStoreId) ?? null

  async function switchStore(id: string) {
    await authClient.organization.setActive({ organizationId: id })
    router.refresh()
  }

  async function signOut() {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Store className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{active?.name ?? 'Pick a store'}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {active?.slug ?? `${stores.length} available`}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {stores.map((s) => (
                  <DropdownMenuItem key={s.id} onSelect={() => switchStore(s.id)}>
                    {s.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem asChild>
                  <Link href="/select-store">Create a store</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Store</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut />
              <span className="truncate">{user.email}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
