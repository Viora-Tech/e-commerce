/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'
import type { ReactNode } from 'react'
import StepUpProvider from '@/components/auth/step-up-dialog'
import LocaleProvider from '@/components/layout/locale-provider'
import MotionProvider from '@/components/layout/motion-provider'
import ThemeProvider from '@/components/layout/theme-provider'
import { localeFromCookieHeader } from '@/lib/i18n'
import { DEFAULT_REGION } from '@/lib/region'
import { queryClient } from '~/query'
import css from '~/styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Admin (lab)' },
    ],
    links: [{ rel: 'stylesheet', href: css }],
  }),
  shellComponent: RootDocument,
  component: RootProviders,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        className="min-h-svh bg-sidebar font-sans text-body text-foreground antialiased"
        suppressHydrationWarning
      >
        {children}
        <Scripts />
      </body>
    </html>
  )
}

/** The admin's root-layout providers, in the same order (app/layout.tsx). */
function RootProviders() {
  // SPA: the language cookie is read in the browser instead of by the server render.
  const locale = localeFromCookieHeader(typeof document === 'undefined' ? '' : document.cookie)
  return (
    <ThemeProvider nonce={undefined}>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <LocaleProvider locale={locale} region={DEFAULT_REGION}>
            <MotionProvider>
              <StepUpProvider>
                <Outlet />
              </StepUpProvider>
            </MotionProvider>
          </LocaleProvider>
        </NuqsAdapter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
