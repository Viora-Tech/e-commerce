import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Head, Search } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import type { ReactNode } from 'react'
import LogoMark from '../components/logo-mark'
import SiteFooter from '../components/site-footer'
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

/* Ocean Green accent (#4ea674 light, #30d158 dark) through Nextra's primary-colour hook; it
   drives the active sidebar link, links, focus rings and the TOC. Backgrounds are our white
   light theme and Nextra's normal dark grey. */
const primaryColor = {
  hue: { light: 146, dark: 135 },
  saturation: { light: 36, dark: 64 },
  lightness: { light: 48, dark: 50 },
}
const backgroundColor = { light: '#ffffff', dark: 'rgb(17,17,17)' }

const navbar = (
  <Navbar logo={<LogoMark size={20} withWordmark />} projectLink={GITHUB_URL} align="right" />
)

const footer = (
  <Footer>
    <SiteFooter />
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
      <Head color={primaryColor} backgroundColor={backgroundColor} />
      <body>
        <Layout
          navbar={navbar}
          pageMap={pageMap}
          docsRepositoryBase={`${GITHUB_URL}/tree/main/apps/docs/content`}
          footer={footer}
          search={<Search />}
          sidebar={{ defaultMenuCollapseLevel: 2, toggleButton: true }}
          toc={{ title: 'On this page', backToTop: 'Scroll to top' }}
          editLink="Edit this page on GitHub"
          feedback={{ content: null }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
