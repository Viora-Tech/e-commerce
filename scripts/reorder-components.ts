/**
 * One-off codemod: regroups each component body into the conventions.md phases
 * (hooks, helpers/handlers, early returns, render logic, return) and inserts the
 * section comments. Keeps statement order inside each phase. Refuses to move a
 * render-logic const that a hook reads (that would break scope) and reports it.
 *
 *   bun scripts/reorder-components.ts [--write] [paths...]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dir, '..')
const WRITE = process.argv.includes('--write')
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'))

type Phase = 0 | 1 | 2 | 3
const LABEL: Record<Phase, string> = {
  0: '// Hooks',
  1: '// Helpers',
  2: '// Early returns',
  3: '// Render logic',
}

function isHookCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false
  const c = node.expression
  if (ts.isIdentifier(c)) return /^use[A-Z]/.test(c.text)
  if (ts.isPropertyAccessExpression(c)) return /^use[A-Z]/.test(c.name.text)
  return false
}
const isHookStmt = (s: ts.Statement) =>
  (ts.isExpressionStatement(s) && isHookCall(s.expression)) ||
  (ts.isVariableStatement(s) &&
    s.declarationList.declarations.some(
      (d) =>
        !!d.initializer &&
        (isHookCall(d.initializer) ||
          (ts.isAwaitExpression(d.initializer) && isHookCall(d.initializer.expression))),
    ))
const isArrowStmt = (s: ts.Statement) =>
  ts.isVariableStatement(s) &&
  s.declarationList.declarations.some(
    (d) =>
      !!d.initializer &&
      (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)),
  )
const isHandlerStmt = (s: ts.Statement) =>
  isArrowStmt(s) &&
  (s as ts.VariableStatement).declarationList.declarations.some(
    (d) => ts.isIdentifier(d.name) && /^handle[A-Z]/.test(d.name.text),
  )
const isGuard = (s: ts.Statement) => {
  if (!ts.isIfStatement(s)) return false
  const t = s.thenStatement
  return (
    ts.isReturnStatement(t) ||
    (ts.isBlock(t) &&
      t.statements.length === 1 &&
      ts.isReturnStatement(t.statements[0] as ts.Statement))
  )
}
function phaseOf(s: ts.Statement): Phase | 'return' {
  if (ts.isReturnStatement(s)) return 'return'
  if (isHookStmt(s)) return 0
  if (isArrowStmt(s)) return 1
  if (isGuard(s)) return 2
  return 3
}
function declaredNames(s: ts.Statement): string[] {
  if (!ts.isVariableStatement(s)) return []
  const out: string[] = []
  const walk = (n: ts.BindingName) => {
    if (ts.isIdentifier(n)) out.push(n.text)
    else for (const el of n.elements) if (!ts.isOmittedExpression(el)) walk(el.name)
  }
  for (const d of s.declarationList.declarations) walk(d.name)
  return out
}
function identifiersUsed(n: ts.Node): Set<string> {
  const out = new Set<string>()
  const visit = (x: ts.Node) => {
    if (ts.isIdentifier(x)) out.add(x.text)
    ts.forEachChild(x, visit)
  }
  visit(n)
  return out
}

function componentBodies(sf: ts.SourceFile): { name: string; body: ts.Block }[] {
  const out: { name: string; body: ts.Block }[] = []
  const hasJsx = (n: ts.Node) => {
    let f = false
    const v = (x: ts.Node) => {
      if (f) return
      if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) f = true
      else ts.forEachChild(x, v)
    }
    v(n)
    return f
  }
  for (const st of sf.statements) {
    if (
      ts.isFunctionDeclaration(st) &&
      st.name &&
      /^[A-Z]/.test(st.name.text) &&
      st.body &&
      hasJsx(st.body)
    )
      out.push({ name: st.name.text, body: st.body })
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) {
        const i = d.initializer
        if (
          ts.isIdentifier(d.name) &&
          /^[A-Z]/.test(d.name.text) &&
          i &&
          (ts.isArrowFunction(i) || ts.isFunctionExpression(i)) &&
          ts.isBlock(i.body) &&
          hasJsx(i)
        )
          out.push({ name: d.name.text, body: i.body })
      }
  }
  return out
}

function stripSectionComments(text: string): string {
  return text.replace(
    /^[ \t]*\/\/ (Hooks|Helpers|Event handlers|Early returns|Render logic)[ \t]*\r?\n/gm,
    '',
  )
}

function processFile(file: string): { changed: boolean; notes: string[] } {
  const original = readFileSync(file, 'utf8')
  const notes: string[] = []
  let text = original
  // Work from last component to first so offsets stay valid.
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const comps = componentBodies(sf).reverse()
  for (const { name, body } of comps) {
    const stmts = body.statements
    if (stmts.length === 0) continue
    const items = stmts.map((s) => ({ s, phase: phaseOf(s) }))
    const ret = items.filter((i) => i.phase === 'return')
    const rest = items.filter((i) => i.phase !== 'return') as { s: ts.Statement; phase: Phase }[]
    const alreadyOrdered = rest.every(
      (it, i) => i === 0 || (rest[i - 1] as { phase: Phase }).phase <= it.phase,
    )
    const hasAnyHookOrArrow = rest.some((i) => i.phase === 0 || i.phase === 1)
    const bodyText = text.slice(body.getStart() + 1, body.getEnd() - 1)
    const hasComments = /\/\/ (Hooks|Helpers|Event handlers|Early returns|Render logic)/.test(
      bodyText,
    )
    if (alreadyOrdered && (!hasAnyHookOrArrow || hasComments)) continue

    // Consts that a guard (early return) reads must stay above that guard: pull them into
    // the early-returns group, in original order, ahead of the guard.
    const guardDeps = new Set<number>()
    for (let g = 0; g < rest.length; g++) {
      const it = rest[g] as { s: ts.Statement; phase: Phase }
      if (it.phase !== 2) continue
      const used = identifiersUsed(it.s)
      for (let i = 0; i < g; i++) {
        const dep = rest[i] as { s: ts.Statement; phase: Phase }
        if (dep.phase === 3 && declaredNames(dep.s).some((n) => used.has(n))) guardDeps.add(i)
      }
    }
    // Transitive: a guard dep may itself read an earlier render const.
    let grew = true
    while (grew) {
      grew = false
      for (const gi of [...guardDeps]) {
        const used = identifiersUsed((rest[gi] as { s: ts.Statement }).s)
        for (let i = 0; i < gi; i++) {
          const dep = rest[i] as { s: ts.Statement; phase: Phase }
          if (
            dep.phase === 3 &&
            !guardDeps.has(i) &&
            declaredNames(dep.s).some((n) => used.has(n))
          ) {
            guardDeps.add(i)
            grew = true
          }
        }
      }
    }

    // Safety: a render-logic const that a later hook reads cannot move below the hook.
    let blocked = false
    for (let i = 0; i < rest.length && !blocked; i++) {
      const it = rest[i] as { s: ts.Statement; phase: Phase }
      if (it.phase !== 3) continue
      const names = declaredNames(it.s)
      for (let h = i + 1; h < rest.length; h++) {
        const later = rest[h] as { s: ts.Statement; phase: Phase }
        if (later.phase === 0 && names.some((n) => identifiersUsed(later.s).has(n))) {
          notes.push(`${name}: "${names.join(', ')}" is read by a hook below it; reorder by hand`)
          blocked = true
          break
        }
      }
    }
    if (blocked) continue

    // Regroup, keeping order inside each phase; helpers (non-handle arrows) before handlers.
    const groups: Record<Phase, ts.Statement[]> = { 0: [], 1: [], 2: [], 3: [] }
    rest.forEach((it, i) => {
      groups[guardDeps.has(i) ? 2 : it.phase].push(it.s)
    })
    const helpers = groups[1].filter((s) => !isHandlerStmt(s))
    const handlers = groups[1].filter((s) => isHandlerStmt(s))

    const indent = (() => {
      const first = stmts[0] as ts.Statement
      const lineStart = text.lastIndexOf('\n', first.getStart()) + 1
      return text.slice(lineStart, first.getStart())
    })()
    const stmtText = (s: ts.Statement) => {
      // include leading comments (JSDoc etc.) but drop old section comments
      const full = text.slice(s.getFullStart(), s.getEnd())
      return stripSectionComments(full)
        .replace(/^\s*\n/, '')
        .replace(/^\n+/, '')
    }
    const section = (label: string, list: ts.Statement[]) => {
      if (list.length === 0) return ''
      return `${indent}${label}\n${list.map((s) => `${indent}${stmtText(s).replace(/^\s+/, '')}`).join('\n')}\n`
    }
    const parts = [
      section(LABEL[0], groups[0]),
      section(LABEL[1], helpers),
      section('// Event handlers', handlers),
      section(LABEL[2], groups[2]),
      section(LABEL[3], groups[3]),
      ret.map((r) => `${indent}${stmtText(r.s).replace(/^\s+/, '')}`).join('\n'),
    ].filter(Boolean)
    const newBody = `\n${parts.join('\n')}\n${indent.slice(0, Math.max(0, indent.length - 2))}`
    text = text.slice(0, body.getStart() + 1) + newBody + text.slice(body.getEnd() - 1)
  }
  const changed = text !== original
  if (changed && WRITE) writeFileSync(file, text)
  return { changed, notes }
}

async function main() {
  const roots = ['apps', 'packages/blocks/src', 'packages/editor/src', 'packages/ui/src']
  const files = new Set<string>()
  for (const root of roots) {
    const glob = new Bun.Glob('**/*.tsx')
    for await (const rel of glob.scan({ cwd: path.join(ROOT, root) })) {
      const norm = `${root}/${rel}`.replaceAll('\\', '/')
      if (norm.includes('/node_modules/') || norm.includes('/.next/')) continue
      if (root === 'apps' && !/^apps\/[^/]+\/src\//.test(norm)) continue
      if (norm.startsWith('packages/ui/src/components/shadcn/')) continue
      if (norm.endsWith('.test.tsx')) continue
      if (ONLY.length && !ONLY.some((o) => norm.includes(o))) continue
      files.add(path.join(ROOT, norm))
    }
  }
  let changed = 0
  for (const f of [...files].sort()) {
    const r = processFile(f)
    const rel = path.relative(ROOT, f).replaceAll('\\', '/')
    if (r.changed) {
      changed++
      console.log(`${WRITE ? 'rewrote' : 'would rewrite'} ${rel}`)
    }
    for (const n of r.notes) console.log(`  note ${rel}: ${n}`)
  }
  console.log(`${changed} file(s) ${WRITE ? 'rewritten' : 'to rewrite'}`)
}
await main()
