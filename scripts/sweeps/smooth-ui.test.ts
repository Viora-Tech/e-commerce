/**
 * Sweep: the "Smooth UI" rules (docs/conventions.md) for the admin and the shared UI package.
 *
 * 1. No `transition-all` / `transition: all`. It animates every property that changes, layout
 *    ones included (width, height, padding), so a hover or a class flip can relayout the page on
 *    every frame. Name the properties: `transition-[color,background-color,scale]`.
 * 2. No backdrop blur on a fixed or sticky container (bars, headers, overlays). The blur behind it
 *    is redrawn on every scroll and animation frame; Chromium on Windows (Brave, Chrome, Edge)
 *    dropped frames on it. Use a solid surface (`bg-raised`, `bg-popover`, `glass-bar`).
 * 3. Any other backdrop blur (class, CSS or inline style) is allow-listed per file with a reason:
 *    small, static, short-lived surfaces only (a drop-zone hint, a sign-in illustration).
 *
 * Ratchet (docs/guardrails.md): a new use outside the allow-list fails, and a listed file that no
 * longer has one fails too, so the list only shrinks.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { listFiles, loadSourceFile, ROOT, toRel } from './walk'

const SCOPE_ROOTS = ['apps/admin/src', 'packages/ui/src', 'packages/editor/src']

type AllowEntry = { file: string; reason: string }

/** Backdrop blur that is allowed to stay: small, static or short-lived, never fixed or sticky. */
const BLUR_ALLOWLIST: AllowEntry[] = [
  {
    file: 'apps/admin/src/components/auth/glass-card.tsx',
    reason:
      'two small static cards in the sign-in illustration, over a still background: nothing scrolls or animates behind them',
  },
  {
    file: 'apps/admin/src/components/products/product-image-card.tsx',
    reason:
      'the "drop to upload" hint over one image card, shown only while a file is dragged over it',
  },
  {
    file: 'apps/admin/src/components/themes/customize/image-field.tsx',
    reason: 'the drop hint over one image field in the theme editor, shown only while dragging',
  },
  {
    file: 'apps/admin/src/components/themes/customize/editor-loading.tsx',
    reason: 'a 2px blur behind the theme editor\'s "could not load" message, a static error state',
  },
]

/** Backdrop blur on a fixed/sticky container. Empty: fix it instead (rule 2). */
const FIXED_BLUR_ALLOWLIST: AllowEntry[] = []

/** `transition-all`. Empty: name the properties instead (rule 1). */
const TRANSITION_ALL_ALLOWLIST: AllowEntry[] = []

const BLUR_CLASS =
  /(?:^|[\s:!])backdrop-(?:blur|saturate|brightness|contrast|grayscale|invert|sepia|hue-rotate|opacity)(?:-|\[|\s|$)|\[(?:-webkit-)?backdrop-filter:(?!none\])/
const POSITIONED = /(?:^|[\s:!])(?:fixed|sticky)(?:\s|$)/
const TRANSITION_ALL_CLASS = /(?:^|[\s:!])transition-all(?:\s|$)/
/**
 * In CSS: a backdrop-filter declaration that is not `none` or a token (the tokens are `none` in
 * the admin). `@supports (backdrop-filter: ...)` conditions are not declarations.
 */
const BLUR_CSS = /(?<![(\w-])backdrop-filter\s*:(?!\s*(?:none\b|var\())/
const TRANSITION_ALL_CSS = /transition(?:-property)?\s*:\s*all\b/

type Finding = { blur: boolean; fixedBlur: boolean; transitionAll: boolean }

/** Class-like text in a source file: string literals and whole template literals. */
function classTexts(sf: ts.SourceFile): string[] {
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text)
    if (ts.isTemplateExpression(n)) {
      out.push([n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' '))
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

/** Inline style objects: `backdropFilter: ...` and `transition: 'all ...'`. */
function styleFindings(sf: ts.SourceFile): { blur: boolean; transitionAll: boolean } {
  let blur = false
  let transitionAll = false
  const visit = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n)) {
      const name = n.name.getText(sf).replace(/['"]/g, '')
      if (/^(?:Webkit)?[bB]ackdropFilter$|^-webkit-backdrop-filter$|^backdrop-filter$/.test(name)) {
        const value = n.initializer
        if (!(ts.isStringLiteralLike(value) && value.text.trim() === 'none')) blur = true
      }
      if (
        /^transition(?:Property)?$/.test(name) &&
        ts.isStringLiteralLike(n.initializer) &&
        /^\s*all\b/.test(n.initializer.text)
      ) {
        transitionAll = true
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return { blur, transitionAll }
}

function listCss(dir: string, out: string[]): void {
  let entries: import('node:fs').Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) listCss(full, out)
    else if (e.name.endsWith('.css')) out.push(full)
  }
}

let cached: Promise<Map<string, Finding>> | null = null

/** Every file in scope with a backdrop blur or transition-all, read once for all four tests. */
function findings(): Promise<Map<string, Finding>> {
  cached ??= scan()
  return cached
}

async function scan(): Promise<Map<string, Finding>> {
  const out = new Map<string, Finding>()
  for (const f of await listFiles(SCOPE_ROOTS, { includeTests: false })) {
    const sf = loadSourceFile(f)
    const texts = classTexts(sf)
    const style = styleFindings(sf)
    const blurTexts = texts.filter((t) => BLUR_CLASS.test(t))
    const found: Finding = {
      blur: blurTexts.length > 0 || style.blur,
      fixedBlur: blurTexts.some((t) => POSITIONED.test(t)),
      transitionAll: texts.some((t) => TRANSITION_ALL_CLASS.test(t)) || style.transitionAll,
    }
    if (found.blur || found.transitionAll) out.set(toRel(f), found)
  }
  const css: string[] = []
  for (const root of SCOPE_ROOTS) listCss(path.join(ROOT, root), css)
  for (const f of css) {
    const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const found: Finding = {
      blur: BLUR_CSS.test(text),
      fixedBlur: false,
      transitionAll: TRANSITION_ALL_CSS.test(text),
    }
    if (found.blur || found.transitionAll) out.set(toRel(f), found)
  }
  return out
}

function files(all: Map<string, Finding>, key: keyof Finding): string[] {
  return [...all].filter(([, f]) => f[key]).map(([file]) => file)
}

function listed(list: AllowEntry[], file: string): boolean {
  return list.some((e) => e.file === file)
}

describe('sweep: smooth-ui', () => {
  it('no transition-all (name the properties)', async () => {
    const hits = files(await findings(), 'transitionAll')
    const unlisted = hits.filter((f) => !listed(TRANSITION_ALL_ALLOWLIST, f))
    expect(unlisted, `transition-all; name the properties:\n${unlisted.join('\n')}`).toEqual([])
    expect(TRANSITION_ALL_ALLOWLIST.filter((e) => !hits.includes(e.file))).toEqual([])
  })

  it('no backdrop blur on a fixed or sticky container', async () => {
    const hits = files(await findings(), 'fixedBlur')
    const unlisted = hits.filter((f) => !listed(FIXED_BLUR_ALLOWLIST, f))
    expect(
      unlisted,
      `backdrop blur on a fixed/sticky container; use a solid surface:\n${unlisted.join('\n')}`,
    ).toEqual([])
    expect(FIXED_BLUR_ALLOWLIST.filter((e) => !hits.includes(e.file))).toEqual([])
  })

  it('every other backdrop blur is allow-listed with a reason', async () => {
    const hits = files(await findings(), 'blur')
    const unlisted = hits.filter(
      (f) => !listed(BLUR_ALLOWLIST, f) && !listed(FIXED_BLUR_ALLOWLIST, f),
    )
    expect(unlisted, `new backdrop blur:\n${unlisted.join('\n')}`).toEqual([])
  })

  it('the backdrop blur allow-list has no stale entries', async () => {
    const hits = files(await findings(), 'blur')
    expect(BLUR_ALLOWLIST.filter((e) => !hits.includes(e.file))).toEqual([])
  })
})
