import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACCOUNTS_PREFIX,
  checkoutHostname,
  DERIVED_HEADERS,
  INTERNAL_PREFIX,
  isProbePath,
  listingSearch,
  MISSING_ROUTE_HEADER,
  PASSWORD_PREFIX,
  primaryRedirect,
  RENDER_TICKET_HEADER,
  redirectHostFor,
  routeForAccounts,
  routeForCheckoutHost,
  routeForStore,
  STORE_ROUTE_SEGMENTS,
} from './routing'

describe('routeForStore', () => {
  it("rewrites IndexNow's root key file onto its route, and nothing else ending in .txt", () => {
    const key = '0123456789abcdef0123456789abcdef'
    expect(routeForStore('store-a', `/${key}.txt`)).toEqual({
      kind: 'rewrite',
      path: `/-s/store-a/indexnow/${key}`,
    })
    expect(routeForStore('store-a', '/llms.txt')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/llms.txt',
    })
  })

  it("rewrites Shopify's product and collection JSON onto their child routes", () => {
    expect(routeForStore('store-a', '/products/mouse.json')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/products/mouse/product.json',
    })
    expect(routeForStore('store-a', '/products.json')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/products.json',
    })
  })

  it('rewrites a public path onto the internal store segment', () => {
    expect(routeForStore('store-a', '/')).toEqual({ kind: 'rewrite', path: '/-s/store-a' })
    expect(routeForStore('store-a', '/products/mouse')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/products/mouse',
    })
  })

  it('refuses direct requests to the internal prefix so one store cannot address another', () => {
    expect(routeForStore('store-a', `${INTERNAL_PREFIX}/store-b/products/mouse`)).toEqual({
      kind: 'forbidden',
    })
    expect(routeForStore('store-a', `${INTERNAL_PREFIX}`)).toEqual({ kind: 'forbidden' })
    expect(routeForStore('store-a', `${PASSWORD_PREFIX}/store-b`)).toEqual({ kind: 'forbidden' })
  })

  it('leaves Next internals and API routes alone', () => {
    expect(routeForStore('store-a', '/_next/static/x.js')).toEqual({ kind: 'passthrough' })
    expect(routeForStore('store-a', '/api/health')).toEqual({ kind: 'passthrough' })
  })
})

describe('primaryRedirect', () => {
  const base = {
    hostname: 'www.brand.in',
    port: '',
    pathname: '/products/glasspad',
    search: '?variant=2',
    protocol: 'https:',
    primaryHostname: 'brand.in',
    redirect: true,
    inFrame: false,
    previewing: false,
    dev: false,
  }

  it('sends a redirecting domain to the primary, keeping path and query', () => {
    expect(primaryRedirect(base)).toBe('https://brand.in/products/glasspad?variant=2')
  })

  it('forces https in production even when the edge forwarded plain http', () => {
    expect(primaryRedirect({ ...base, protocol: 'http:', port: '8080' })).toBe(
      'https://brand.in/products/glasspad?variant=2',
    )
  })

  it('keeps the scheme and port in development', () => {
    expect(
      primaryRedirect({
        ...base,
        dev: true,
        protocol: 'http:',
        port: '3100',
        hostname: 'old.test',
      }),
    ).toBe('http://brand.in:3100/products/glasspad?variant=2')
  })

  it('serves the page when the domain does not redirect, is the primary, or there is none', () => {
    expect(primaryRedirect({ ...base, redirect: false })).toBeNull()
    expect(primaryRedirect({ ...base, hostname: 'brand.in' })).toBeNull()
    expect(primaryRedirect({ ...base, primaryHostname: null })).toBeNull()
  })

  it('never redirects frames, theme previews, APIs or webhooks', () => {
    expect(primaryRedirect({ ...base, inFrame: true })).toBeNull()
    expect(primaryRedirect({ ...base, previewing: true })).toBeNull()
    expect(primaryRedirect({ ...base, pathname: '/api/cart' })).toBeNull()
    expect(primaryRedirect({ ...base, pathname: '/_next/static/x.js' })).toBeNull()
    expect(primaryRedirect({ ...base, pathname: '/webhooks/razorpay' })).toBeNull()
    expect(primaryRedirect({ ...base, pathname: `${INTERNAL_PREFIX}/x` })).toBeNull()
  })
})

describe('primaryRedirect from the platform subdomain', () => {
  // `waimers.koomerce.app` redirects once www.waimers.in is primary (`setPrimaryDomain`).
  const platform = {
    hostname: 'waimers.koomerce.app',
    port: '',
    pathname: '/collections/mice',
    search: '?sort_by=price-ascending&page=2&utm_source=ig',
    protocol: 'https:',
    primaryHostname: 'www.waimers.in',
    redirect: true,
    inFrame: false,
    previewing: false,
    dev: false,
  }

  it('sends shoppers to the same path and query on the custom primary', () => {
    expect(primaryRedirect(platform)).toBe(
      'https://www.waimers.in/collections/mice?sort_by=price-ascending&page=2&utm_source=ig',
    )
    expect(primaryRedirect({ ...platform, pathname: '/', search: '' })).toBe(
      'https://www.waimers.in/',
    )
  })

  it('keeps the theme editor canvas, admin thumbnails and theme previews on the subdomain', () => {
    expect(primaryRedirect({ ...platform, inFrame: true })).toBeNull()
    expect(primaryRedirect({ ...platform, previewing: true })).toBeNull()
  })

  it('leaves API calls and gateway webhooks where they were sent', () => {
    expect(primaryRedirect({ ...platform, pathname: '/api/beacon' })).toBeNull()
    expect(primaryRedirect({ ...platform, pathname: '/webhooks/razorpay' })).toBeNull()
  })

  it('serves the subdomain while it is the primary, or the merchant switched the redirect off', () => {
    expect(primaryRedirect({ ...platform, primaryHostname: 'waimers.koomerce.app' })).toBeNull()
    expect(primaryRedirect({ ...platform, redirect: false })).toBeNull()
  })
})

describe('redirectHostFor', () => {
  const markets = [null, 'waimers.ae']
  it("sends a market domain's www twin to that domain", () => {
    expect(redirectHostFor('www.waimers.ae', 'waimers.in', markets)).toBe('waimers.ae')
  })
  it('sends the apex to a market on www', () => {
    expect(redirectHostFor('shop.de', 'waimers.in', ['www.shop.de'])).toBe('www.shop.de')
  })
  it('sends every other redirecting domain to the primary', () => {
    expect(redirectHostFor('www.waimers.in', 'waimers.in', markets)).toBe('waimers.in')
    expect(redirectHostFor('old-shop.com', 'waimers.in', markets)).toBe('waimers.in')
  })
})

describe('routeForAccounts (platform login domain)', () => {
  it('serves only provider sign-in and the Truecaller callback', () => {
    expect(routeForAccounts('/oauth/google/start')).toEqual({
      kind: 'rewrite',
      path: '/-a/oauth/google/start',
    })
    expect(routeForAccounts('/oauth/apple/callback')).toEqual({
      kind: 'rewrite',
      path: '/-a/oauth/apple/callback',
    })
    expect(routeForAccounts('/truecaller/callback')).toEqual({
      kind: 'rewrite',
      path: '/-a/truecaller/callback',
    })
    for (const p of ['/', '/account', '/oauth/github/start', '/oauth/google/start/x', '/-s/x']) {
      expect(routeForAccounts(p)).toEqual({ kind: 'forbidden' })
    }
  })

  it('never lets a store host reach the login domain routes', () => {
    expect(routeForStore('store-a', `${ACCOUNTS_PREFIX}/oauth/google/start`)).toEqual({
      kind: 'forbidden',
    })
  })
})

describe('checkoutHostname', () => {
  it('strips the configured subdomain to the store primary', () => {
    expect(checkoutHostname('checkout.waimers.com', 'checkout')).toBe('waimers.com')
    expect(checkoutHostname('checkout.shop.koomerce.app', 'checkout')).toBe('shop.koomerce.app')
  })
  it('is null when the flag is off or the host is not a checkout host', () => {
    expect(checkoutHostname('waimers.com', 'checkout')).toBeNull()
    expect(checkoutHostname('checkout.waimers.com', null)).toBeNull()
    expect(checkoutHostname('checkout.', 'checkout')).toBeNull()
    expect(checkoutHostname(null, 'checkout')).toBeNull()
  })
})

describe('routeForCheckoutHost', () => {
  it('serves only the hand-off entry and checkout pages', () => {
    expect(routeForCheckoutHost('store-a', '/checkout')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/checkout',
    })
    expect(routeForCheckoutHost('store-a', '/c/tok123')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/c/tok123',
    })
    expect(routeForCheckoutHost('store-a', '/checkout/thank-you/42')).toMatchObject({
      kind: 'rewrite',
    })
  })
  it('passes assets and api through, and 404s everything else', () => {
    expect(routeForCheckoutHost('store-a', '/_next/static/x.js')).toEqual({ kind: 'passthrough' })
    expect(routeForCheckoutHost('store-a', '/products/mouse')).toEqual({ kind: 'forbidden' })
    expect(routeForCheckoutHost('store-a', '/')).toEqual({ kind: 'forbidden' })
  })
})

describe('listingSearch', () => {
  it('keeps filters, terms, sort and page in a stable order, drops the rest', () => {
    const params = new URLSearchParams(
      'utm_source=x&sort_by=price-ascending&filter.p.m.custom.grip=Palm&q=mouse&filter.p.m.custom.grip=Claw&page=2&filter.v.price.gte=&fbclid=y',
    )
    expect(listingSearch(params)).toBe(
      'filter.p.m.custom.grip=Claw&filter.p.m.custom.grip=Palm&page=2&q=mouse&sort_by=price-ascending',
    )
    expect(listingSearch(new URLSearchParams('utm_source=x'))).toBe('')
  })

  it("keeps a search form's sold-out choice, not its other options", () => {
    const params = new URLSearchParams(
      'q=pad&options[prefix]=last&options[unavailable_products]=last&type=product',
    )
    expect(listingSearch(params)).toBe('options%5Bunavailable_products%5D=last&q=pad')
  })
})

describe('scanner probes', () => {
  // The 26 Nov 2026 scan, plus the usual WordPress and admin-panel guesses.
  const probes = [
    '/.env',
    '/.env.production',
    '/.git/config',
    '/.svn/entries',
    '/.aws/credentials',
    '/.DS_Store',
    '/backup/db.sql',
    '/backup',
    '/backups/site.tar.gz',
    '/db.sql',
    '/dump.sql.gz',
    '/site.zip',
    '/www.tar',
    '/config.php',
    '/index.php',
    '/xmlrpc.php',
    '/wp-login.php',
    '/wp-admin/install.php',
    '/wp-content/uploads/x.png',
    '/phpmyadmin/',
    '/phpMyAdmin/index.php',
    '/terraform.tfstate',
    '/terraform/main.tf',
    '/compose.yaml',
    '/compose.yml',
    '/docker-compose.yml',
    '/web.config.bak',
    '/index.html.orig',
    '/settings.old',
    '/.index.php.swp',
    '/default.asp',
    '/login.aspx',
    '/admin.jsp',
    '/cgi-bin/test.cgi',
    '/products/mouse/.env',
  ]

  it.each(probes)('answers %s with a bare 404', (path) => {
    expect(isProbePath(path)).toBe(true)
    expect(routeForStore('store-a', path)).toEqual({ kind: 'forbidden' })
  })

  // Every kind of URL a store serves, including the dotted ones.
  const pages = [
    '/',
    '/products/mouse',
    '/products/mouse.json',
    '/products/mouse.js',
    '/products/mouse.md',
    '/products/mouse/product.json',
    '/products.json',
    '/collections/all',
    '/collections/mice.json',
    '/collections.json',
    '/pages/about-us',
    '/blogs/news/launch',
    '/cart',
    '/cart.js',
    '/checkout',
    '/account/login',
    '/affiliate',
    '/search?q=pad',
    '/search/suggest.json',
    '/sitemap.xml',
    '/sitemap_products_1.xml',
    '/robots.txt',
    '/llms.txt',
    '/feeds/products.xml',
    '/feeds/products.csv',
    '/apps/reviews',
    '/cdn/shop/files/logo.png',
    '/webhooks/razorpay',
    '/theme-assets/t1/base.css',
    '/theme-assets/t1/old-theme.js.bak',
    '/.well-known/apple-app-site-association',
    '/.well-known/security.txt',
    '/policies/refund-policy',
    '/0123456789abcdef0123456789abcdef.txt',
  ]

  it.each(pages)('leaves %s alone', (path) => {
    expect(isProbePath(path.split('?')[0] as string)).toBe(false)
  })

  it('never refuses Next internals or the API', () => {
    expect(routeForStore('store-a', '/_next/static/chunks/main.js.old')).toEqual({
      kind: 'passthrough',
    })
    expect(routeForStore('store-a', '/api/webhooks/x.php')).toEqual({ kind: 'passthrough' })
  })
})

describe('missing routes', () => {
  it('marks a path no store route serves, so its 404 renders once for all of them', () => {
    expect(routeForStore('store-a', '/no-such-page')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/no-such-page',
      missing: true,
    })
    expect(routeForStore('store-a', '/admin/login')).toMatchObject({ missing: true })
    expect(routeForStore('store-a', '/.well-known/security.txt')).toMatchObject({ missing: true })
  })

  it.each([
    '/',
    '/products/mouse',
    '/products/mouse.json',
    '/collections/all',
    '/pages/about',
    '/policies/privacy-policy',
    '/sitemap_products_1.xml',
    '/robots.txt',
    '/track-order',
  ])('does not mark %s', (path) => {
    const route = routeForStore('store-a', path)
    expect(route.kind).toBe('rewrite')
    expect(route).not.toHaveProperty('missing')
  })

  it('lists every route folder under app/-s/[storeId]', () => {
    const dir = fileURLToPath(new URL('../app/-s/[storeId]', import.meta.url))
    const folders = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('[') && !e.name.startsWith('('))
      .map((e) => e.name)
      .sort()
    expect([...STORE_ROUTE_SEGMENTS].sort()).toEqual(folders)
  })

  it('keeps the flag and the ticket out of what a client may send', () => {
    expect(DERIVED_HEADERS).toContain(MISSING_ROUTE_HEADER)
    expect(DERIVED_HEADERS).toContain(RENDER_TICKET_HEADER)
  })
})
