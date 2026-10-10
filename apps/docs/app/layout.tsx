import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans, Geist_Mono } from 'next/font/google'
import { Head, Search } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import type { ReactNode } from 'react'
import LogoMark from '../components/logo-mark'
import SiteFooter from '../components/site-footer'
import { brand } from '../data/home'
import './globals.css'
import 'nextra-theme-docs/style.css'

export const metadata: Metadata = {
  title: {
    default: `${brand.name} ${brand.suffix}`,
    template: `%s – ${brand.name} ${brand.suffix}`,
  },
  description: `Merchant guide and developer docs for ${brand.name}.`,
}

/* DM Sans (SIL OFL 1.1) for text and Bricolage Grotesque (SIL OFL 1.1) for headings: the same
   pair as apps/admin/src/app/layout.tsx. Geist Mono stays for code. */
const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-primary',
  weight: ['400', '500', '600'],
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display-face',
  weight: ['700', '800'],
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

/* The admin's single blue (#3f72dc light, #7fa2f5 dark, packages/ui/src/styles.css) through
   Nextra's primary-colour hook; it drives the active sidebar link, links, focus rings and the
   TOC. Page backgrounds are the admin's card white and its dark panel. */
const primaryColor = {
  hue: { light: 219, dark: 224 },
  saturation: { light: 70, dark: 86 },
  lightness: { light: 55, dark: 72 },
}
const backgroundColor = { light: '#ffffff', dark: '#101216' }

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
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
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
