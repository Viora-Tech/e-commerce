'use client'

import { SidebarInset } from '../../shadcn/sidebar'

type Props = {
  children: React.ReactNode
  sidebar: React.ReactNode
  header: React.ReactNode
  mobileNavbar?: React.ReactNode
  /** Full-bleed pages (the page builder) skip the padded scroll container. */
  immersive?: boolean
}

export function WithSidebarShell({ children, sidebar, header, mobileNavbar, immersive }: Props) {
  return (
    <>
      {sidebar}
      <SidebarInset className={immersive ? 'h-dvh min-h-0 overflow-hidden' : undefined}>
        {mobileNavbar}
        {header}
        {immersive ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        ) : (
          <div className="flex min-h-0 max-h-dvh flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-6 md:max-h-[calc(100vh-4.5rem)]">
            {children}
          </div>
        )}
      </SidebarInset>
    </>
  )
}
