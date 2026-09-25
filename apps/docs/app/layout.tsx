import type { Metadata } from 'next'
import { Head, Search } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import type { ReactNode } from 'react'
import 'nextra-theme-docs/style.css'

export const metadata: Metadata = {
  title: {
    default: 'Waimers Commerce Docs',
    template: '%s – Waimers Commerce Docs',
  },
  description: 'Merchant guide and developer docs for the Waimers Commerce Platform.',
}

const GITHUB_URL = 'https://github.com/Viora-Tech/e-commerce'

const logo = (
  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#4EA674" />
      <path
        d="M6 12.5 10 16.5 18 8"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    Waimers Commerce Docs
  </span>
)

const navbar = <Navbar logo={logo} projectLink={GITHUB_URL} />

const footer = (
  <Footer>
    <span>MIT {new Date().getFullYear()} © Waimers Commerce Docs. Built with Nextra.</span>
  </Footer>
)

type RootLayoutProps = {
  children: ReactNode
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const pageMap = await getPageMap()
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={pageMap}
          docsRepositoryBase={`${GITHUB_URL}/tree/main/apps/docs/content`}
          footer={footer}
          search={<Search />}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
