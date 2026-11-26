/** SOURCE OF TRUTH: one-hop apex redirect — WHAT: put the apex-to-www middleware on a redirect-only apex's plain-http router too, in the storefront app's Traefik config / WHY: Dokploy gives the http router only `redirect-to-https`, so http://brand.in took two hops (https, then www) */

/*
 * Dokploy writes two routers per domain into the storefront app's Traefik file: `web` (port 80)
 * with `redirect-to-https`, and `websecure` with the domain's own middlewares. Our
 * `apex-to-www@file` sits only on the second, so `http://brand.in/a` went to `https://brand.in/a`
 * and then to `https://www.brand.in/a`. The middleware's regex already accepts `http://`, so
 * swapping it in for `redirect-to-https` on the apex's `web` router makes it one hop. Let's
 * Encrypt's HTTP challenge is answered by Traefik's own router first, so it is unaffected.
 *
 * Dokploy keeps hand edits to other routers when it adds or removes a domain (it parses the file
 * and writes it back), and the route job re-applies this on every run, so a re-registered apex
 * gets it again. The patch is line-based on Dokploy's own YAML output (2-space indent); a file it
 * cannot read is left untouched.
 */

const HTTPS_REDIRECT = 'redirect-to-https'

const indentOf = (line: string) => line.length - line.trimStart().length

/** The `- item` values of a YAML block list under `key:` inside `lines`, with their line numbers. */
function listItems(lines: string[], key: string): { at: number; value: string }[] {
  const start = lines.findIndex((l) => l.trim() === `${key}:`)
  if (start < 0) return []
  const keyIndent = indentOf(lines[start] ?? '')
  const out: { at: number; value: string }[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (!line.trim()) continue
    const t = line.trim()
    if (!t.startsWith('- ') || indentOf(line) < keyIndent) break
    out.push({ at: i, value: t.slice(2).trim().replace(/^['"]|['"]$/g, '') })
  }
  return out
}

/** True when the router's rule is exactly `Host(`hostname`)`, optionally with a path match. */
function matchesHost(block: string[], hostname: string): boolean {
  const rule = block.find((l) => l.trim().startsWith('rule:'))
  if (!rule) return false
  const value = rule
    .trim()
    .slice('rule:'.length)
    .trim()
    .replace(/^['"]|['"]$/g, '')
  return value === `Host(\`${hostname}\`)` || value.startsWith(`Host(\`${hostname}\`) && Path`)
}

/**
 * The storefront app's Traefik config with `middleware` in place of `redirect-to-https` on every
 * plain-http router for `hostname`. `changed` is false when there was nothing to swap (already
 * done, no such router, or a file this cannot read).
 */
export function oneHopApexConfig(
  config: string,
  hostname: string,
  middleware: string,
): { config: string; changed: boolean } {
  const lines = config.split('\n')
  const routersAt = lines.findIndex((l) => l.trim() === 'routers:')
  if (routersAt < 0) return { config, changed: false }
  const routersIndent = indentOf(lines[routersAt] ?? '')
  let changed = false
  let i = routersAt + 1
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.trim() && indentOf(line) <= routersIndent) break
    if (!line.trim() || !line.trimEnd().endsWith(':')) {
      i++
      continue
    }
    // One router: its key line, then every deeper line.
    const routerIndent = indentOf(line)
    let end = i + 1
    while (end < lines.length) {
      const l = lines[end] ?? ''
      if (l.trim() && indentOf(l) <= routerIndent) break
      end++
    }
    const block = lines.slice(i, end)
    const entryPoints = listItems(block, 'entryPoints').map((e) => e.value)
    if (matchesHost(block, hostname) && entryPoints.includes('web')) {
      const middlewares = listItems(block, 'middlewares')
      const redirect = middlewares.find((m) => m.value === HTTPS_REDIRECT)
      if (redirect) {
        const at = i + redirect.at
        const old = lines[at] ?? ''
        const already = middlewares.some((m) => m.value === middleware)
        if (already) lines.splice(at, 1)
        else lines[at] = `${old.slice(0, indentOf(old))}- ${middleware}`
        changed = true
        if (already) end--
      }
    }
    i = end
  }
  return { config: changed ? lines.join('\n') : config, changed }
}

/** What `ensureOneHopApex` needs from the Dokploy client. */
export type TraefikConfigClient = {
  readTraefikConfig?: (() => Promise<string | null>) | undefined
  updateTraefikConfig?: ((config: string) => Promise<void>) | undefined
}

/**
 * Make `hostname`'s plain-http router redirect straight to the www. Returns whether it wrote the
 * config. A client without the Traefik calls (older Dokploy, test fakes) is a no-op.
 */
export async function ensureOneHopApex(
  client: TraefikConfigClient,
  hostname: string,
  middleware: string,
): Promise<boolean> {
  if (!client.readTraefikConfig || !client.updateTraefikConfig) return false
  const current = await client.readTraefikConfig()
  if (!current) return false
  const next = oneHopApexConfig(current, hostname, middleware)
  if (!next.changed) return false
  await client.updateTraefikConfig(next.config)
  return true
}
