#!/usr/bin/env bun
/**
 * SOURCE OF TRUTH KEYWORDS: security-audit, bun audit, dependency gate, SCA, pre-release
 * WHAT: Runs `bun audit --json` and FAILS (exit 1) when a CRITICAL or HIGH advisory affects a
 *   DIRECT dependency (one we declare in a workspace package.json), unless the advisory id is
 *   triaged in ALLOW. Transitive high/criticals (pulled in by a dep of a dep, e.g. the `shadcn`
 *   CLI chain) and lower severities print as warnings and never block.
 * WHY: A point-in-time audit or pentest is a snapshot — it cannot catch a CVE disclosed the
 *   following week. This gate runs before every dev→main release, so a newly-published advisory
 *   (e.g. the Sep-2026 `better-auth` OAuth account-takeover, which landed AFTER the Oct audits and
 *   was only caught once we ran `bun audit`) is caught the next time we ship, not by luck.
 * WHERE: `bun run audit`, and a step in the release checklist (developer docs → Release checklist).
 *
 * `bun audit --json` emits a flat map `{ "<pkg>": Advisory[] }` with no `isDirect` flag and no
 * per-path versions. So a package is treated as OUR exposure only when it is declared in a
 * workspace manifest AND the lowest version our declared range can resolve to still falls inside
 * the advisory's vulnerable range. A package we declare but have already pinned above the fix (our
 * floor excludes the vulnerable range) is a transitive-only copy — a warning, not a blocker. When
 * the vulnerable range can't be proven excluded (open-ended, `||`, or unparseable), we block, so a
 * real direct exposure is never hidden by a parsing gap.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Severities that block when they hit a direct dependency. */
const BLOCK = new Set(['critical', 'high'])

/**
 * Advisories triaged and accepted, by advisory id (number) or GHSA slug → reason. Keep this short
 * and revisit it every release; an entry here is a decision to ship with a known issue in a direct
 * dependency, so it must say why.
 */
const ALLOW: Record<string, string> = {}

type Advisory = {
  id?: number
  url?: string
  title?: string
  severity?: string
  vulnerable_versions?: string
}

/** name → every version range we declare for it, across the root and all workspace manifests. */
function declaredDependencies(): Map<string, string[]> {
  const ranges = new Map<string, string[]>()
  const addManifest = (path: string) => {
    let pkg: Record<string, Record<string, string>>
    try {
      pkg = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return
    }
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(pkg[field] ?? {})) {
        ranges.set(name, [...(ranges.get(name) ?? []), range])
      }
    }
  }
  addManifest('package.json')
  for (const group of ['apps', 'packages']) {
    let entries: string[]
    try {
      entries = readdirSync(group)
    } catch {
      continue
    }
    for (const dir of entries) addManifest(join(group, dir, 'package.json'))
  }
  return ranges
}

/** Numeric semver compare, prerelease ignored. */
function cmp(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/** The bare x.y.z at the start of a version token (`^4.6.7` → `4.6.7`, `v1.2` → `1.2`). */
function bareVersion(token: string): string | null {
  return /(\d+(?:\.\d+)*)/.exec(token)?.[1] ?? null
}

/** The lowest version a declared range can resolve to (min floor across `||` alternatives). */
function rangeFloor(ranges: string[]): string | null {
  let floor: string | null = null
  for (const range of ranges) {
    if (range.startsWith('workspace:') || range.startsWith('catalog:')) continue
    for (const alt of range.split('||')) {
      const v = bareVersion(alt)
      if (v && (floor === null || cmp(v, floor) < 0)) floor = v
    }
  }
  return floor
}

/** For a single-band advisory, the fixed version (its `<`/`<=` upper bound). null = can't prove. */
function fixedAt(vuln: string): { ver: string; inclusive: boolean } | null {
  if (!vuln || vuln.includes('||')) return null // multiple bands: don't try, block
  const m = /<(=?)\s*(\d+(?:\.\d+)*)/.exec(vuln)
  if (!m) return null // no upper bound (open-ended): can't prove excluded
  return { ver: m[2] as string, inclusive: m[1] === '=' }
}

/** True when our declared floor is at or above the fix, so our own usage is not exposed. */
function flooredSafe(ranges: string[] | undefined, adv: Advisory): boolean {
  const floor = rangeFloor(ranges ?? [])
  const fixed = fixedAt(adv.vulnerable_versions ?? '')
  if (!floor || !fixed) return false
  return fixed.inclusive ? cmp(floor, fixed.ver) > 0 : cmp(floor, fixed.ver) >= 0
}

function parseAudit(): Record<string, Advisory[]> {
  const res = Bun.spawnSync(['bun', 'audit', '--json'])
  const text = `${res.stdout?.toString() ?? ''}`
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) {
    console.error('security-audit: could not find JSON in `bun audit --json` output:\n', text)
    process.exit(2)
  }
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch (err) {
    console.error('security-audit: invalid JSON from `bun audit --json`:', err)
    process.exit(2)
  }
}

const SEVERITY_RANK = ['low', 'moderate', 'high', 'critical']
const worst = (a: string, b: string) =>
  SEVERITY_RANK.indexOf(a) >= SEVERITY_RANK.indexOf(b) ? a : b

function isAllowed(adv: Advisory): boolean {
  const id = adv.id != null ? String(adv.id) : ''
  if (id && ALLOW[id]) return true
  const url = adv.url ?? ''
  return Object.keys(ALLOW).some((k) => k.length > 3 && (url.includes(k) || id === k))
}

const declared = declaredDependencies()
const audit = parseAudit()
const blocking: string[] = []
const warnings: string[] = []

for (const [pkg, advisories] of Object.entries(audit)) {
  const bad = (advisories ?? []).filter((a) => BLOCK.has((a.severity ?? '').toLowerCase()))
  if (bad.length === 0) continue
  const maxSeverity = bad.reduce((s, a) => worst(s, (a.severity ?? '').toLowerCase()), 'low')
  const ranges = declared.get(pkg)
  const isDeclared = ranges !== undefined
  // Our exposure = a blocking advisory that is NOT triaged AND NOT already excluded by our
  // declared floor. A declared package whose floor sits above the fix is a transitive-only copy.
  const ourExposure = bad.filter((a) => !isAllowed(a) && !flooredSafe(ranges, a))
  const blocks = isDeclared && ourExposure.length > 0
  const why = !isDeclared
    ? ' (transitive)'
    : ourExposure.length === 0
      ? ' (direct — our floor is above the fix / triaged)'
      : ' (direct)'
  const label = `${maxSeverity.toUpperCase()} ${pkg}${why} — ${bad[0]?.title ?? bad[0]?.url ?? ''}`
  if (blocks) blocking.push(label)
  else warnings.push(label)
}

if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} high/critical NOT blocking (transitive or triaged):`)
  for (const w of warnings.sort()) console.log(`  · ${w}`)
}

if (blocking.length) {
  console.error(`\n✖ security-audit: ${blocking.length} high/critical in a DIRECT dependency:`)
  for (const b of blocking.sort()) console.error(`  ✖ ${b}`)
  console.error(
    '\nBump the version, or (if genuinely accepted) add the advisory id to ALLOW in scripts/security-audit.ts with a reason.\n',
  )
  process.exit(1)
}

console.log('\n✓ security-audit: no high/critical advisories in direct dependencies.\n')
