import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
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
  metadataBase: new URL(siteConfig.urls.docs),
  alternates: { canonical: './' },
  openGraph: {
    siteName: `${brand.name} ${brand.suffix}`,
    type: 'website',
    locale: 'en_IN',
    images: [{ url: `${siteConfig.urls.site}/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
}

/* Plus Jakarta Sans (SIL OFL 1.1) for text and headings: the landing page's face
   (apps/www/src/app/layout.tsx), so docs and site read as one. Geist Mono stays for code. */
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-primary',
  weight: ['400', '500', '600', '700', '800'],
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

/* The brand orange (#ff6a13, apps/www --color-cta) through Nextra's primary-colour hook; it
   drives the active sidebar link, links, focus rings and the TOC. Page backgrounds are the
   landing page's white and its near-black. */
const primaryColor = {
  hue: { light: 22, dark: 22 },
  saturation: { light: 90, dark: 100 },
  lightness: { light: 42, dark: 62 },
}
const backgroundColor = { light: '#ffffff', dark: '#0a0a0a' }

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
          nextThemes={{ defaultTheme: 'dark' }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
