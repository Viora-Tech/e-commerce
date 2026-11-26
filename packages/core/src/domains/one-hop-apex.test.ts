/** SOURCE OF TRUTH: one-hop apex tests — WHAT: the Traefik config patch swaps redirect-to-https for apex-to-www on the apex's http router only / WHY: http://apex took two hops, and a wrong swap could redirect a store's www or another store */
import { describe, expect, it } from 'vitest'
import { ensureOneHopApex, oneHopApexConfig } from './one-hop-apex'

const MW = 'apex-to-www@file'

/** The shape Dokploy writes for two https domains on the storefront app. */
const CONFIG = `http:
  routers:
    storefront-abc-router-37:
      rule: Host(\`brand.in\`)
      service: storefront-abc-service-37
      middlewares:
        - redirect-to-https
      entryPoints:
        - web
    storefront-abc-router-websecure-37:
      rule: Host(\`brand.in\`)
      service: storefront-abc-service-37
      middlewares:
        - apex-to-www@file
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
    storefront-abc-router-38:
      rule: Host(\`www.brand.in\`)
      service: storefront-abc-service-38
      middlewares:
        - redirect-to-https
      entryPoints:
        - web
    storefront-abc-router-39:
      rule: Host(\`other.in\`)
      service: storefront-abc-service-39
      middlewares:
        - redirect-to-https
      entryPoints:
        - web
  services:
    storefront-abc-service-37:
      loadBalancer:
        servers:
          - url: http://storefront-abc:3100
`

describe('oneHopApexConfig', () => {
  it("swaps only the apex's plain-http router", () => {
    const r = oneHopApexConfig(CONFIG, 'brand.in', MW)
    expect(r.changed).toBe(true)
    const lines = r.config.split('\n')
    // Router 37 (web): the swap.
    expect(lines[6]).toBe(`        - ${MW}`)
    // www, the other store and the https router keep theirs.
    expect(r.config.match(/- redirect-to-https/g)).toHaveLength(2)
    expect(r.config.match(/- apex-to-www@file/g)).toHaveLength(2)
    expect(r.config).toContain('certResolver: letsencrypt')
    expect(r.config.split('\n')).toHaveLength(CONFIG.split('\n').length)
  })

  it('is idempotent', () => {
    const once = oneHopApexConfig(CONFIG, 'brand.in', MW).config
    expect(oneHopApexConfig(once, 'brand.in', MW)).toEqual({ config: once, changed: false })
  })

  it('drops redirect-to-https when the router already lists the middleware', () => {
    const both = CONFIG.replace(
      '        - redirect-to-https\n      entryPoints:\n        - web\n    storefront-abc-router-websecure-37',
      `        - redirect-to-https\n        - ${MW}\n      entryPoints:\n        - web\n    storefront-abc-router-websecure-37`,
    )
    const r = oneHopApexConfig(both, 'brand.in', MW)
    expect(r.changed).toBe(true)
    expect(r.config).toBe(oneHopApexConfig(CONFIG, 'brand.in', MW).config)
  })

  it('never matches a longer hostname that ends the same way', () => {
    expect(oneHopApexConfig(CONFIG, 'and.in', MW).changed).toBe(false)
    expect(oneHopApexConfig(CONFIG, 'rand.in', MW).changed).toBe(false)
  })

  it('leaves a file it cannot read untouched', () => {
    expect(oneHopApexConfig('', 'brand.in', MW)).toEqual({ config: '', changed: false })
    expect(oneHopApexConfig('{"http":{}}', 'brand.in', MW).changed).toBe(false)
  })
})

describe('ensureOneHopApex', () => {
  it('writes the patched file once, then nothing', async () => {
    let file = CONFIG
    const writes: string[] = []
    const client = {
      readTraefikConfig: async () => file,
      updateTraefikConfig: async (next: string) => {
        writes.push(next)
        file = next
      },
    }
    expect(await ensureOneHopApex(client, 'brand.in', MW)).toBe(true)
    expect(await ensureOneHopApex(client, 'brand.in', MW)).toBe(false)
    expect(writes).toHaveLength(1)
  })

  it('is a no-op for a client without the Traefik calls or with no file', async () => {
    expect(await ensureOneHopApex({}, 'brand.in', MW)).toBe(false)
    const client = { readTraefikConfig: async () => null, updateTraefikConfig: async () => {} }
    expect(await ensureOneHopApex(client, 'brand.in', MW)).toBe(false)
  })
})
