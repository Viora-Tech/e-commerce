import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Head, Search } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import type { ReactNode } from 'react'
import LogoMark from '../components/logo-mark'
import './globals.css'
import 'nextra-theme-docs/style.css'

export const metadata: Metadata = {
  title: {
    default: 'Waimers Commerce Docs',
    template: '%s – Waimers Commerce Docs',
  },
  description: 'Merchant guide and developer docs for the Waimers Commerce Platform.',
}

/* Geist (SIL OFL 1.1), same face as apps/admin. */
const sans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
})

const GITHUB_URL = 'https://github.com/Viora-Tech/e-commerce'

const navbar = (
  <Navbar logo={<LogoMark size={22} withWordmark />} projectLink={GITHUB_URL} align="right" />
)

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
    <html
      lang="en"
      dir="ltr"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
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
