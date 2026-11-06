/**
 * Sweep: the production compose file (`deploy/docker-compose.prod.yml`) passes every app
 * setting to the apps and gives outbound internet only to the services that need it
 * (security audit D-12). Not a ratchet. Text-based on purpose: the file is plain, and the
 * sweeps carry no YAML dependency.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './walk'

const COMPOSE = readFileSync(path.join(ROOT, 'deploy/docker-compose.prod.yml'), 'utf8')
const ENV_SCHEMA = readFileSync(path.join(ROOT, 'packages/config/src/env.ts'), 'utf8')
const PROD_EXAMPLE = readFileSync(path.join(ROOT, 'deploy/env.production.example'), 'utf8')

/** Settings the running apps never read in production, with the reason. */
const NOT_FOR_APPS: Record<string, string> = {
  WORKER_PORT: 'fixed at 4100 inside the image',
  SEED_OWNER_EMAIL: 'dev seed only',
  BACKUP_R2_ACCOUNT_ID: 'backup service only (its own environment block)',
  BACKUP_R2_ACCESS_KEY_ID: 'backup service only',
  BACKUP_R2_SECRET_ACCESS_KEY: 'backup service only',
  BACKUP_R2_BUCKET: 'backup service only',
  BACKUP_LOCAL_DIR: 'dev backups only',
  LOCAL_STORAGE_DIR: 'local disk storage is not used in production',
  NODE_ENV: 'set by the images and x-app-env itself (production), never by the operator',
  DOKPLOY_URL: 'worker only (its own environment block)',
  DOKPLOY_API_KEY: 'worker only (its own environment block), kept out of admin and storefront',
  DOKPLOY_STOREFRONT_APPLICATION_ID: 'worker only (its own environment block)',
  DOKPLOY_STOREFRONT_PORT: 'worker only (its own environment block)',
  CLOUDFLARE_API_TOKEN:
    'admin and worker only (their own environment blocks), kept out of storefront',
  THEME_SCREENSHOT_CHROMIUM:
    'set inside the worker image (Dockerfile ENV from the THEME_SCREENSHOTS build arg); an x-app-env entry would blank it',
}

function schemaKeys(): string[] {
  return [...ENV_SCHEMA.matchAll(/^ {2}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1] as string)
}

function appEnvBlock(): string {
  const start = COMPOSE.indexOf('x-app-env:')
  const end = COMPOSE.indexOf('\nservices:')
  return COMPOSE.slice(start, end)
}

/** `networks: [a, b]` of one service, by name. */
function serviceNetworks(service: string): string[] {
  const start = COMPOSE.search(new RegExp(`^ {2}${service}:\\s*$`, 'm'))
  if (start < 0) return []
  const rest = COMPOSE.slice(start + 1)
  const next = rest.search(/^ {2}[a-z][\w-]*:\s*$|^\S/m)
  const body = next < 0 ? rest : rest.slice(0, next)
  const m = body.match(/^ {4}networks:\s*\[([^\]]*)\]/m)
  return m?.[1] ? m[1].split(',').map((s) => s.trim()) : []
}

describe('sweep: deploy-compose', () => {
  it('passes every app setting from env.ts to the apps', () => {
    const block = appEnvBlock()
    const missing = schemaKeys().filter((k) => !(k in NOT_FOR_APPS) && !block.includes(`${k}:`))
    expect(
      missing,
      `add to x-app-env in deploy/docker-compose.prod.yml: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('documents every app setting in deploy/env.production.example', () => {
    const missing = schemaKeys().filter((k) => !(k in NOT_FOR_APPS) && !PROD_EXAMPLE.includes(k))
    expect(missing, `document in deploy/env.production.example: ${missing.join(', ')}`).toEqual([])
  })

  it('keeps the data stores off the internet and gives worker and backup a way out', () => {
    expect(serviceNetworks('postgres')).toEqual(['internal'])
    expect(serviceNetworks('dragonfly')).toEqual(['internal'])
    expect(serviceNetworks('migrate')).toEqual(['internal'])
    expect(serviceNetworks('worker')).toEqual(['internal', 'egress'])
    expect(serviceNetworks('backup')).toEqual(['internal', 'egress'])
    expect(serviceNetworks('admin')).toEqual(['internal', 'web'])
    expect(serviceNetworks('storefront')).toEqual(['internal', 'web'])
  })

  it('declares internal as internal and egress as an ordinary bridge', () => {
    const networks = COMPOSE.slice(COMPOSE.search(/^networks:\s*$/m))
    expect(networks).toMatch(/^ {2}internal:\s*\n(?: {4}#.*\n)* {4}internal: true/m)
    const egress = networks.slice(networks.search(/^ {2}egress:/m))
    expect(egress.split(/\n {2}\S/)[0]).not.toMatch(/internal: true/)
  })
})
