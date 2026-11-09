/**
 * Build the Waimers-style landing page as an Instatic page tree from clean HTML
 * (same importHtml pipeline the editor's "Paste HTML" and plugin pack layouts use),
 * swap the <koomerce-*> placeholders for the plugin's modules, save it through the
 * editor's own save endpoint and publish the site.
 *
 * Run from the Instatic checkout so `@core/*` resolves:
 *   bun .eval-plugins/landing/build-page.ts
 */

import { importHtml } from '@core/htmlImport'
import { createNode, type PageNode, type StyleRule } from '@core/page-tree'
import { cssToStyleRules } from '@core/siteImport'
import { installPackCompileEnvironment } from '../../src/core/plugin-sdk/cli/packCompileEnvironment'

installPackCompileEnvironment()

const BASE = 'http://localhost:3001'
const OWNER = { email: 'eval@koomerce.test', password: 'eval-instatic-2026!' }
let cookie = ''
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (cookie) headers.set('cookie', cookie)
  if (typeof init.body === 'string') headers.set('content-type', 'application/json')
  headers.set('origin', BASE)
  const r = await fetch(BASE + path, { ...init, headers })
  const sc = r.headers.getSetCookie()
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ')
  const text = await r.text()
  // biome-ignore lint/suspicious/noExplicitAny: untyped Instatic admin API answers in a one-off eval script
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  return { status: r.status, json, text }
}

const html = await Bun.file(new URL('./landing.html', import.meta.url)).text()
const { nodes, rootIds, styleCss } = importHtml(html)

// Swap placeholders for plugin modules.
for (const node of Object.values(nodes)) {
  const tag = node.props?.customTag
  if (tag === 'koomerce-atc') {
    node.moduleId = 'koomerce.shop.add-to-cart'
    node.props = {
      variantId: '{currentEntry.variantId}',
      label: 'Add to cart',
      availability: '{currentEntry.availability}',
    }
    node.children = []
  } else if (tag === 'koomerce-atc-hero') {
    // A fixed-variant button outside any loop. Also works around an Instatic
    // 0.0.21 bug: site-wide module CSS/JS collection (server/publish/siteModuleAssets.ts)
    // renders pages without loop data, so a module used ONLY inside a loop gets
    // neither its CSS nor its /_instatic/module-js script.
    node.moduleId = 'koomerce.shop.add-to-cart'
    node.props = {
      variantId: 'HS-WM-HL8K-MB',
      label: 'Add Hyperlight to cart',
      availability: 'in-stock',
    }
    node.children = []
  } else if (tag === 'koomerce-cart') {
    node.moduleId = 'koomerce.shop.cart-count'
    node.props = { label: 'Cart' }
    node.children = []
  }
}

// Site state + style rules.
await api('/admin/api/cms/login', { method: 'POST', body: JSON.stringify(OWNER) })
const siteRes = await api('/admin/api/cms/site')
const site = siteRes.json.site
const shellSeq: number = siteRes.json.seq

const { rules } = cssToStyleRules(styleCss, { breakpoints: site.breakpoints })
const styleRules: Record<string, StyleRule> = { ...site.styleRules }
const idByName = new Map<string, string>()
let order = Object.keys(styleRules).length
const now = Date.now()
rules.forEach((rule, i) => {
  const id = rule.kind === 'class' ? `waimers-landing/${rule.name}` : `waimers-landing/ambient-${i}`
  if (rule.kind === 'class') idByName.set(rule.name, id)
  styleRules[id] = { ...rule, id, order: order++, createdAt: now, updatedAt: now } as StyleRule
})
for (const node of Object.values(nodes)) {
  node.classIds = (node.classIds ?? []).flatMap((name) =>
    idByName.has(name) ? [idByName.get(name) as string] : [],
  )
}

const body = createNode('base.body') as PageNode
body.id = 'waimers-landing-body'
body.children = [...rootIds]
for (const id of rootIds) nodes[id].parentId = body.id
nodes[body.id] = body

const pagesRes = await api('/admin/api/cms/pages')
type PageRow = { id: string; slug: string; seq: number }
const home = ((pagesRes.json?.rows ?? []) as PageRow[]).find((r) => r.slug === 'index')
const page = {
  id: home?.id ?? 'waimers-landing',
  slug: 'index',
  title: 'Waimers — premium gaming gear',
  rootNodeId: body.id,
  nodes,
}

const nextSite = {
  ...site,
  styleRules,
  settings: {
    ...site.settings,
    metaTitle: 'Waimers | Premium Gaming Mice, Keyboards & Glasspads India',
    metaDescription:
      'Genuine Pulsar, Wooting, Lofree and ATK gaming gear, shipped from India with local warranty.',
  },
}

const save = await api('/admin/api/cms/site-document', {
  method: 'PUT',
  body: JSON.stringify({
    mode: 'incremental',
    site: nextSite,
    changedPages: [page],
    deletedPageIds: [],
    changedComponents: [],
    deletedComponentIds: [],
    changedLayouts: [],
    deletedLayoutIds: [],
    baseSeqs: home ? { [home.id]: home.seq } : {},
    shellBaseSeq: shellSeq,
  }),
})
console.log('save', save.status, save.text.slice(0, 400))
if (save.status >= 300) process.exit(1)

await api('/admin/api/cms/auth/step-up', {
  method: 'POST',
  body: JSON.stringify({ password: OWNER.password }),
})
const pub = await api('/admin/api/cms/publish', { method: 'POST', body: '{}' })
console.log('publish', pub.status, pub.text.slice(0, 600))
