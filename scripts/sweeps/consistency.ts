/**
 * SOURCE OF TRUTH KEYWORDS: near-duplicate-files, duplicate-helpers, date-format, status-literals,
 *   server-only-guard, domain-errors, router-magic-limits, file-size, HELPER_OWNERS
 * WHAT:  The finders behind the consistency sweeps (`scripts/sweeps/<name>.test.ts`): each returns
 *        today's violations as stable strings so a test can compare them with its allow-list.
 * WHY:   Kept apart from the tests so a finder can be run on its own to (re)build an allow-list,
 *        and so the tests read as "rule + allow-list + two assertions" like the older sweeps.
 * WHERE: Imported by the sweep tests; documented in docs/guardrails.md.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { listFiles, loadSourceFile, parseImports, SERVER_ONLY_PACKAGES, toRel } from './walk'

const SOURCE_ROOTS = ['apps', 'packages']

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
}

function visit(node: ts.Node, fn: (n: ts.Node) => void): void {
  fn(node)
  ts.forEachChild(node, (c) => visit(c, fn))
}

/* ---------------------------------------------------------------- near-duplicate-files */

/** A file pair is a near duplicate above this share of identical normalised lines. */
export const NEAR_DUPLICATE_RATIO = 0.85
/** Files shorter than this (normalised lines) are never compared. */
export const NEAR_DUPLICATE_MIN_LINES = 40
/** Lines found in more files than this are boilerplate (`}`, `return (`) and not counted. */
const COMMON_LINE_FILES = 40

/** Trimmed, non-blank lines that are not imports or comments. */
function normalisedLines(text: string): string[] {
  const out: string[] = []
  let inBlock = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (inBlock) {
      if (line.includes('*/')) inBlock = false
      continue
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true
      continue
    }
    if (
      !line ||
      line.startsWith('//') ||
      line.startsWith('import ') ||
      line.startsWith('} from ')
    ) {
      continue
    }
    out.push(line)
  }
  return out
}

/**
 * `a <-> b (NN%)` for every pair of source files whose normalised lines match at least
 * `NEAR_DUPLICATE_RATIO` of the longer file, both over `NEAR_DUPLICATE_MIN_LINES` lines.
 * The pair string has no percentage so allow-list entries stay stable as the files change.
 */
export async function nearDuplicatePairs(): Promise<string[]> {
  const files = await listFiles(SOURCE_ROOTS, { includeTests: false })
  const counts: { rel: string; lines: Map<string, number>; size: number }[] = []
  const filesPerLine = new Map<string, number>()
  for (const f of files) {
    const lines = normalisedLines(readFileSync(f, 'utf8'))
    if (lines.length <= NEAR_DUPLICATE_MIN_LINES) continue
    const m = new Map<string, number>()
    for (const l of lines) m.set(l, (m.get(l) ?? 0) + 1)
    for (const l of m.keys()) filesPerLine.set(l, (filesPerLine.get(l) ?? 0) + 1)
    counts.push({ rel: toRel(f), lines: m, size: lines.length })
  }
  // Inverted index on distinctive lines only, so each file meets just its plausible twins.
  const index = new Map<string, number[]>()
  counts.forEach((c, i) => {
    for (const l of c.lines.keys()) {
      if ((filesPerLine.get(l) ?? 0) > COMMON_LINE_FILES) continue
      const list = index.get(l)
      if (list) list.push(i)
      else index.set(l, [i])
    }
  })
  const out: string[] = []
  counts.forEach((a, i) => {
    const seen = new Set<number>()
    for (const l of a.lines.keys()) for (const j of index.get(l) ?? []) if (j > i) seen.add(j)
    for (const j of seen) {
      const b = counts[j]
      if (!b) continue
      const longer = Math.max(a.size, b.size)
      if (Math.min(a.size, b.size) < longer * NEAR_DUPLICATE_RATIO) continue
      let shared = 0
      for (const [l, n] of a.lines) shared += Math.min(n, b.lines.get(l) ?? 0)
      if (shared / longer >= NEAR_DUPLICATE_RATIO) out.push(`${a.rel} <-> ${b.rel}`)
    }
  })
  return out.sort()
}

/* ---------------------------------------------------------------- duplicate-helpers */

/**
 * Helpers with ONE home. Declaring a function/const with one of these names anywhere else is
 * a copy (re-exports and imports are fine). Value: the owner file(s).
 */
export const HELPER_OWNERS: Record<string, string[]> = {
  settingsSecret: ['packages/config/src/env.ts'],
  safeEqual: ['packages/payments/src/safe-equal.ts'],
  readableError: ['packages/payments/src/readable-error.ts'],
  timingSafeEqualString: ['packages/shipping/src/webhook-auth.ts'],
  isUniqueViolation: ['packages/db/src/errors.ts'],
  msUntilLaunch: ['packages/core/src/preorder/launch.ts'],
  slugify: ['packages/core/src/catalog/slug.ts'],
  initials: ['apps/admin/src/lib/initials.ts'],
  parseRupees: ['packages/money/src/format.ts'],
  toPaise: [],
  formatSigned: [],
  formatSignedMoney: ['packages/money/src/format.ts'],
  formatPercent: ['packages/money/src/format.ts'],
  inr: [],
  sentryOptions: ['packages/observability/src/sentry-options.ts'],
  redisRateLimiter: ['packages/queue/src/rate-limit.ts'],
  todayIst: [],
  IST_OFFSET_MS: ['packages/dates/src/index.ts'],
  IST_MS: [],
  msUntil: ['packages/dates/src/index.ts'],
  formatCountdown: ['packages/dates/src/index.ts'],
  readTestedFlag: ['apps/admin/src/components/apps/shared/provider-settings.ts'],
}

/** `file: name` for every declaration of a `HELPER_OWNERS` name outside its owner. */
export async function duplicateHelperDeclarations(): Promise<string[]> {
  const files = await listFiles(SOURCE_ROOTS, { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const rel = toRel(f)
    const sf = loadSourceFile(f)
    visit(sf, (n) => {
      let name: string | undefined
      if (ts.isFunctionDeclaration(n) && n.name) name = n.name.text
      else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) name = n.name.text
      if (!name || !Object.hasOwn(HELPER_OWNERS, name)) return
      if (HELPER_OWNERS[name]?.includes(rel)) return
      out.push(`${rel}: ${name}`)
    })
  }
  return [...new Set(out)].sort()
}

/** `const secret = () => loadEnv(process.env).SETTINGS_SECRET` and friends, by file. */
export async function inlineSettingsSecretReads(): Promise<string[]> {
  const files = await listFiles(SOURCE_ROOTS, { includeTests: false })
  return files
    .filter((f) => !toRel(f).startsWith('packages/config/'))
    .filter((f) => /loadEnv\(process\.env\)\.SETTINGS_SECRET\b/.test(readFileSync(f, 'utf8')))
    .map(toRel)
}

/** The IST offset written out (`330 * 60 * 1000`, `5.5 * 3_600_000`, `19_800_000`, ...). */
const IST_LITERAL =
  /\b330\s*\*\s*60\s*\*\s*1_?000\b|\b5\.5\s*\*\s*(?:3_?600_?000|60\s*\*\s*60\s*\*\s*1_?000)\b|\b19_?800_?000\b/

/** Source files (not tests) that spell the IST offset out instead of importing it. */
export async function inlineIstOffsets(): Promise<string[]> {
  const files = await listFiles(SOURCE_ROOTS, { includeTests: false })
  return files
    .filter((f) => !toRel(f).startsWith('packages/dates/'))
    .filter((f) => IST_LITERAL.test(readFileSync(f, 'utf8')))
    .map(toRel)
}

/* ---------------------------------------------------------------- date-format */

const DATE_METHODS = new Set(['toLocaleDateString', 'toLocaleTimeString'])

/**
 * Files that build their own date text: `Intl.DateTimeFormat`, `toLocaleDateString`,
 * `toLocaleTimeString`, or `toLocaleString` with options. The one home is `@commerce/dates`
 * (`formatInZone`), reached in the admin through `useFormat()`.
 */
export async function dateFormatSites(): Promise<string[]> {
  const files = await listFiles(SOURCE_ROOTS, { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const rel = toRel(f)
    if (rel.startsWith('packages/dates/src/')) continue
    const sf = loadSourceFile(f)
    let hit = false
    visit(sf, (n) => {
      if (hit) return
      if (
        ts.isPropertyAccessExpression(n) &&
        n.name.text === 'DateTimeFormat' &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === 'Intl'
      ) {
        hit = true
      }
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const method = n.expression.name.text
        if (DATE_METHODS.has(method)) hit = true
        if (method === 'toLocaleString' && n.arguments.length >= 2) hit = true
      }
    })
    if (hit) out.push(rel)
  }
  return out.sort()
}

/* ---------------------------------------------------------------- hardcoded colours (Tailwind) */

const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const UTILITIES =
  'bg|text|border|border-[trblxy]|ring|ring-offset|fill|stroke|from|via|to|outline|divide|placeholder|decoration|shadow|accent|caret'

/** A Tailwind palette class (`bg-red-500`, `text-gray-300/50`): a raw colour, not a theme token. */
export const TAILWIND_PALETTE_CLASS = new RegExp(
  `(?:^|[\\s"'\`:])(?:${UTILITIES})-(?:${PALETTE})-\\d{2,3}(?:/\\d{1,3})?\\b`,
)

/** Tailwind palette classes inside string/template literals, by line. */
export function findPaletteClasses(sf: ts.SourceFile): number[] {
  const lines: number[] = []
  visit(sf, (n) => {
    if (
      (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n)) &&
      TAILWIND_PALETTE_CLASS.test(n.text)
    ) {
      lines.push(lineOf(sf, n))
    }
  })
  return lines
}

/* ---------------------------------------------------------------- status-literals */

/** UI roots that must take statuses from core, never restate or import them from the schema. */
const UI_ROOTS = ['apps/admin/src', 'apps/storefront/src', 'packages/blocks/src']

/**
 * Array/Set literals in UI code that restate one of core's status lists (same members, any
 * order), and UI type imports of a `...Status` type straight from `@commerce/db`.
 */
export async function statusLiteralSites(
  statusLists: readonly (readonly string[])[],
): Promise<string[]> {
  const keys = new Set(statusLists.map((l) => [...l].sort().join('|')))
  const files = await listFiles(UI_ROOTS, { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const rel = toRel(f)
    const sf = loadSourceFile(f)
    for (const imp of parseImports(sf)) {
      if (imp.specifier === '@commerce/db' && /\b\w+Status\b/.test(imp.text)) {
        out.push(`${rel}: status type from @commerce/db`)
      }
    }
    visit(sf, (n) => {
      if (!ts.isArrayLiteralExpression(n) || n.elements.length < 2) return
      if (!n.elements.every((e) => ts.isStringLiteral(e))) return
      const key = n.elements
        .map((e) => (e as ts.StringLiteral).text)
        .sort()
        .join('|')
      if (keys.has(key)) out.push(`${rel}: [${key.replaceAll('|', ', ')}]`)
    })
  }
  return [...new Set(out)].sort()
}

/* ---------------------------------------------------------------- server-only-guard */

/** App `lib/` folders whose server modules must open with `import 'server-only'`. */
const APP_LIB_ROOTS = ['apps/admin/src/lib', 'apps/storefront/src/lib']

/**
 * App `lib/` modules that value-import a server-only package (or `@commerce/config`, which
 * reads secrets) without `import 'server-only'`. `'use client'` modules are the
 * client-imports-server sweep's business, not this one's.
 */
export async function missingServerOnly(): Promise<string[]> {
  const files = await listFiles(APP_LIB_ROOTS, { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const sf = loadSourceFile(f)
    const imports = parseImports(sf)
    const first = sf.statements[0]
    const isClient =
      !!first &&
      ts.isExpressionStatement(first) &&
      ts.isStringLiteral(first.expression) &&
      first.expression.text === 'use client'
    if (isClient) continue
    const serverValue = imports.some(
      (i) =>
        i.hasValue && (SERVER_ONLY_PACKAGES.has(i.specifier) || i.specifier === '@commerce/config'),
    )
    if (!serverValue) continue
    if (imports.some((i) => i.specifier === 'server-only')) continue
    out.push(toRel(f))
  }
  return out.sort()
}

/* ---------------------------------------------------------------- domain-errors */

const DOMAIN_ROOTS = ['packages/core/src', 'packages/api/src', 'packages/plugins/src']

async function domainFiles(): Promise<string[]> {
  const all = await listFiles(['packages'], { includeTests: false })
  return all.filter((f) => {
    const rel = toRel(f)
    return (
      DOMAIN_ROOTS.some((r) => rel.startsWith(`${r}/`)) ||
      /^packages\/plugin-[^/]+\/src\//.test(rel)
    )
  })
}

/** `file: ClassName` for every `class X extends Error` in core, api and plugins. */
export async function bareErrorClasses(): Promise<string[]> {
  const out: string[] = []
  for (const f of await domainFiles()) {
    const sf = loadSourceFile(f)
    visit(sf, (n) => {
      if (!ts.isClassDeclaration(n) || !n.heritageClauses) return
      const ext = n.heritageClauses.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
      const base = ext?.types[0]?.expression
      if (base && ts.isIdentifier(base) && base.text === 'Error') {
        out.push(`${toRel(f)}: ${n.name?.text ?? '(anonymous)'}`)
      }
    })
  }
  return out.sort()
}

/** Count of `throw new Error(` per router file (only files with at least one). */
export async function routerBareThrows(): Promise<Record<string, number>> {
  const files = await listFiles(['packages/api/src/routers'], { includeTests: false })
  const out: Record<string, number> = {}
  for (const f of files) {
    const sf = loadSourceFile(f)
    let count = 0
    visit(sf, (n) => {
      if (
        ts.isThrowStatement(n) &&
        n.expression &&
        ts.isNewExpression(n.expression) &&
        ts.isIdentifier(n.expression.expression) &&
        n.expression.expression.text === 'Error'
      ) {
        count++
      }
    })
    if (count > 0) out[toRel(f)] = count
  }
  return out
}

/* ---------------------------------------------------------------- router-magic-limits */

/** Input fields whose ceiling is a shared rule (`packages/api/src/procedures/limits.ts`). */
const LIMIT_FIELDS =
  /^(perPage|pageSize|page|limit|search|query|q|ids|orderIds|productIds|variantIds|customerIds)$/

/** `file: field.max(N)` for a numeric literal ceiling on a list/search/bulk input in a router. */
export async function routerMagicLimits(): Promise<string[]> {
  const files = await listFiles(['packages/api/src/routers'], { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const sf = loadSourceFile(f)
    visit(sf, (n) => {
      if (!ts.isPropertyAssignment(n) || !ts.isIdentifier(n.name)) return
      if (!LIMIT_FIELDS.test(n.name.text)) return
      const field = n.name.text
      visit(n.initializer, (c) => {
        if (
          ts.isCallExpression(c) &&
          ts.isPropertyAccessExpression(c.expression) &&
          c.expression.name.text === 'max' &&
          c.arguments[0] &&
          ts.isNumericLiteral(c.arguments[0])
        ) {
          out.push(`${toRel(f)}: ${field}.max(${c.arguments[0].getText(sf)})`)
        }
      })
    })
  }
  return [...new Set(out)].sort()
}

/* ---------------------------------------------------------------- file-size */

/** A `.ts` module longer than this many lines should be split by concern. */
export const FILE_SIZE_MAX_LINES = 500

/** `.ts` (not `.tsx`, not tests, not generated) files over `FILE_SIZE_MAX_LINES`, with sizes. */
export async function oversizedFiles(): Promise<Record<string, number>> {
  const files = await listFiles(SOURCE_ROOTS, { includeTests: false })
  const out: Record<string, number> = {}
  for (const f of files) {
    const rel = toRel(f)
    if (!rel.endsWith('.ts') || rel.endsWith('.generated.ts')) continue
    if (rel.includes('/test/') || rel.includes('/migrations/')) continue
    const lines = readFileSync(f, 'utf8').split('\n').length
    if (lines > FILE_SIZE_MAX_LINES) out[rel] = lines
  }
  return out
}

/* ---------------------------------------------------------------- admin-routes */

/** First path segments of the admin's own pages (`apps/admin/src/app`). */
const ADMIN_SEGMENTS =
  'orders|products|customers|content|analytics|growth|discounts|online-store|apps|settings|account|dev|select-store|onboarding|login|accept-invitation'
const ADMIN_HREF = new RegExp(`^/(?:(?:${ADMIN_SEGMENTS})(?:[/?#].*)?)?$`)
const NAVIGATE_CALLS = new Set(['redirect', 'permanentRedirect', 'push', 'replace', 'prefetch'])

function isHrefPosition(node: ts.Node): boolean {
  let at: ts.Node = node
  // Template literals and JSX `{...}` wrap the string.
  while (ts.isTemplateHead(at) || ts.isTemplateExpression(at)) at = at.parent
  const parent = at.parent
  if (!parent) return false
  if (ts.isJsxAttribute(parent)) return parent.name.getText() === 'href'
  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
    return parent.parent.name.getText() === 'href'
  }
  if (ts.isPropertyAssignment(parent)) return parent.name.getText() === 'href'
  if (ts.isCallExpression(parent)) {
    const callee = ts.isPropertyAccessExpression(parent.expression)
      ? parent.expression.name.text
      : parent.expression.getText()
    return NAVIGATE_CALLS.has(callee)
  }
  return false
}

/**
 * Hardcoded admin paths in `href`s and navigation calls under `apps/admin/src`, counted per
 * file (`routes.ts` is the one home). Tests and `data/hi` (keys, not links) are skipped.
 */
export async function hardcodedAdminHrefs(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const file of await listFiles(['apps/admin/src'])) {
    const rel = toRel(file)
    if (rel === 'apps/admin/src/lib/routes.ts' || rel.startsWith('apps/admin/src/data/hi/'))
      continue
    const sf = loadSourceFile(file)
    let n = 0
    visit(sf, (node) => {
      const text =
        ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
          ? node.text
          : ts.isTemplateHead(node)
            ? node.text
            : null
      if (text === null || !text.startsWith('/')) return
      const isHead = ts.isTemplateHead(node)
      // A template head like `/orders/` is a path prefix; a bare `/` head is not an admin path.
      if (
        !(isHead
          ? new RegExp(`^/(?:${ADMIN_SEGMENTS})(?:[/?#].*)?$`).test(text)
          : ADMIN_HREF.test(text))
      )
        return
      if (isHrefPosition(node)) n++
    })
    if (n > 0) counts.set(rel, n)
  }
  return counts
}

/* ---------------------------------------------------------------- site-config */

/** The brand name (`siteConfig.brand.name`) spelled out in a string or JSX text, by file. */
export async function brandNameSites(brand: string): Promise<string[]> {
  const files: string[] = []
  for (const file of await listFiles(SOURCE_ROOTS)) {
    const rel = toRel(file)
    if (rel.startsWith('apps/docs/') || rel === 'packages/config/src/site.ts') continue
    const sf = loadSourceFile(file)
    let found = false
    visit(sf, (node) => {
      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node) ||
          ts.isJsxText(node)) &&
        node.text.includes(brand)
      ) {
        found = true
      }
    })
    if (found) files.push(rel)
  }
  return files
}
