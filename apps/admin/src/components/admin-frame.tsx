'use client'

import { Frame, Navigation, TopBar } from '@shopify/polaris'
import {
  DiscountIcon,
  HomeIcon,
  OrderIcon,
  PersonIcon,
  ProductIcon,
  SettingsIcon,
  StoreIcon,
} from '@shopify/polaris-icons'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { authClient } from '@/lib/auth-client'

type StoreOption = { id: string; name: string; slug: string }

/** Shopify admin shell: left navigation, top bar with store switcher and user menu. */
export function AdminFrame({
  children,
  user,
  stores,
  activeStoreId,
}: {
  children: ReactNode
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [navOpen, setNavOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
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

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const userMenu = (
    <TopBar.UserMenu
      name={active?.name ?? user.name}
      detail={user.email}
      initials={initials || 'U'}
      open={userOpen}
      onToggle={() => setUserOpen((o) => !o)}
      actions={[
        {
          items: stores
            .filter((s) => s.id !== activeStoreId)
            .map((s) => ({ content: `Switch to ${s.name}`, onAction: () => switchStore(s.id) })),
        },
        { items: [{ content: 'Log out', onAction: signOut }] },
      ]}
    />
  )

  const topBar = (
    <TopBar
      showNavigationToggle
      userMenu={userMenu}
      onNavigationToggle={() => setNavOpen((o) => !o)}
    />
  )

  const is = (prefix: string) => (prefix === '/' ? pathname === '/' : pathname.startsWith(prefix))

  const navigation = (
    <Navigation location={pathname}>
      <Navigation.Section
        items={[
          { url: '/', label: 'Home', icon: HomeIcon, selected: is('/') },
          { url: '/orders', label: 'Orders', icon: OrderIcon, selected: is('/orders') },
          { url: '/products', label: 'Products', icon: ProductIcon, selected: is('/products') },
          { url: '/customers', label: 'Customers', icon: PersonIcon, selected: is('/customers') },
          { url: '/discounts', label: 'Discounts', icon: DiscountIcon, selected: is('/discounts') },
        ]}
      />
      <Navigation.Section
        title="Sales channels"
        items={[
          {
            url: '/online-store',
            label: 'Online Store',
            icon: StoreIcon,
            selected: is('/online-store'),
            subNavigationItems: [
              { url: '/online-store/pages', label: 'Pages' },
              { url: '/online-store/themes', label: 'Themes' },
              { url: '/online-store/navigation', label: 'Navigation' },
            ],
          },
        ]}
      />
      <Navigation.Section
        fill
        items={[
          { url: '/settings', label: 'Settings', icon: SettingsIcon, selected: is('/settings') },
        ]}
        separator
      />
    </Navigation>
  )

  return (
    <Frame
      topBar={topBar}
      navigation={navigation}
      showMobileNavigation={navOpen}
      onNavigationDismiss={() => setNavOpen(false)}
    >
      {children}
    </Frame>
  )
}
