import { createHash } from 'node:crypto'
import { CONSENT_BANNER_MODULE, MARKET_BANNER_MODULE } from './banner-modules'
import { CHAT_MODULE } from './chat-module'
import { CHATWOOT_MODULE } from './chatwoot-module'
import { PIXELS_MODULE } from './pixels-module'

/**
 * The plain HTML page's island modules (docs/design/storefront-plain-html.md, phase 2): small
 * plain-JS files the page's inline island (`islands.ts`) loads only when they are needed, on
 * idle or on interaction, served by `app/api/islands/[file]/route.ts`. No framework.
 *
 * Each file registers itself with the inline island, which hands it its config and helpers:
 * `window.__commerceIsland('<name>', function (config, api) { ... })`. Loaded as a module script
 * with the page's nonce, so the CSP's `strict-dynamic` lets it run.
 */
export const ISLAND_MODULES = {
  pixels: PIXELS_MODULE,
  chat: CHAT_MODULE,
  chatwoot: CHATWOOT_MODULE,
  consent: CONSENT_BANNER_MODULE,
  market: MARKET_BANNER_MODULE,
} as const

export type IslandModuleName = keyof typeof ISLAND_MODULES

const versions = new Map<IslandModuleName, string>()

/** A short content hash: the URL changes when the file does, so it can be cached for a year. */
export function islandModuleVersion(name: IslandModuleName): string {
  let v = versions.get(name)
  if (!v) {
    v = createHash('sha256').update(ISLAND_MODULES[name]).digest('base64url').slice(0, 10)
    versions.set(name, v)
  }
  return v
}

/** Where the page loads a module from. */
export function islandModuleUrl(name: IslandModuleName): string {
  return `/api/islands/${name}.js?v=${islandModuleVersion(name)}`
}

/** The module a `/api/islands/<file>` request asks for, or null. */
export function islandModuleOf(file: string): IslandModuleName | null {
  const name = file.replace(/\.js$/, '')
  return Object.hasOwn(ISLAND_MODULES, name) ? (name as IslandModuleName) : null
}
