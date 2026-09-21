/**
 * Enforces the React component file structure from docs/conventions.md.
 * Run with `bun run lint:components`. Exits 1 on any error.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dir, '..')
const SOFT_LOC = 300
const HARD_LOC = 500
const BANNED_CALLS = new Set(['useCallback', 'useMemo', 'memo'])

type Finding = { file: string; line: number; rule: string; level: 'error' | 'warn' }

const findings: Finding[] = []

function report(
  file: string,
  node: ts.Node | number,
  rule: string,
  level: Finding['level'] = 'error',
) {
  const sf = typeof node === 'number' ? null : node.getSourceFile()
  const line =
    typeof node === 'number'
      ? node
      : sf
        ? sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
        : 0
  findings.push({ file: path.relative(ROOT, file).replaceAll('\\', '/'), line, rule, level })
}

async function collectFiles(): Promise<string[]> {
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
      files.add(path.join(ROOT, norm))
    }
  }
  return [...files].sort()
}

function isPascal(name: string | undefined): boolean {
  return !!name && /^[A-Z]/.test(name)
}

function containsJsx(node: ts.Node): boolean {
  let found = false
  const visit = (n: ts.Node) => {
    if (found) return
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    !!ts.getCombinedModifierFlags(node as ts.Declaration) &&
    (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0
  )
}

/** Function-like nodes whose name is PascalCase and body renders JSX. */
type ComponentDecl = {
  name: string
  node: ts.Node
  body: ts.Block | undefined
  /** `export function X` / `export const X` (named). */
  exported: boolean
  /** `export default function X`, or a later `export default X`. */
  isDefault: boolean
}

function isDefaultExport(node: ts.Node): boolean {
  return (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Default) !== 0
}

function findComponents(sf: ts.SourceFile): ComponentDecl[] {
  const out: ComponentDecl[] = []
  for (const stmt of sf.statements) {
    if (
      ts.isFunctionDeclaration(stmt) &&
      stmt.name &&
      isPascal(stmt.name.text) &&
      stmt.body &&
      containsJsx(stmt.body)
    ) {
      out.push({
        name: stmt.name.text,
        node: stmt,
        body: stmt.body,
        exported: hasExportModifier(stmt) && !isDefaultExport(stmt),
        isDefault: isDefaultExport(stmt),
      })
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !isPascal(decl.name.text) || !decl.initializer) continue
        const init = decl.initializer
        if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && containsJsx(init)) {
          const body = ts.isBlock(init.body) ? init.body : undefined
          out.push({
            name: decl.name.text,
            node: stmt,
            body,
            exported: hasExportModifier(stmt),
            isDefault: false,
          })
        }
      }
    }
  }
  for (const stmt of sf.statements) {
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals && ts.isIdentifier(stmt.expression)) {
      const target = out.find((c) => c.name === stmt.expression.getText())
      if (target) target.isDefault = true
    }
  }
  return out
}

function isInsideGlobalAugmentation(node: ts.Node): boolean {
  let cur: ts.Node | undefined = node.parent
  while (cur) {
    if (ts.isModuleDeclaration(cur) && (cur.flags & ts.NodeFlags.GlobalAugmentation) !== 0)
      return true
    cur = cur.parent
  }
  return false
}

function isHookCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee)) return /^use[A-Z]/.test(callee.text)
  if (ts.isPropertyAccessExpression(callee)) return /^use[A-Z]/.test(callee.name.text)
  return false
}

const SECTION_COMMENTS = [
  '// Hooks',
  '// Helpers',
  '// Event handlers',
  '// Early returns',
  '// Render logic',
]

/**
 * Body order from docs/conventions.md: hooks -> arrow helpers/handlers -> early
 * returns -> render logic (derived consts) -> one return. Each statement is
 * classified into a phase; a phase lower than the current one is an error.
 */
const PHASE = { hooks: 0, arrows: 1, earlyReturns: 2, render: 3 } as const
type Phase = (typeof PHASE)[keyof typeof PHASE]
const PHASE_LABEL: Record<Phase, string> = {
  0: 'hooks',
  1: 'helpers and handlers',
  2: 'early returns',
  3: 'render logic',
}

function isGuardReturn(stmt: ts.Statement): boolean {
  if (!ts.isIfStatement(stmt)) return false
  const s = stmt.thenStatement
  return (
    ts.isReturnStatement(s) ||
    (ts.isBlock(s) &&
      s.statements.length === 1 &&
      ts.isReturnStatement(s.statements[0] as ts.Statement))
  )
}

function isHookStatement(stmt: ts.Statement): boolean {
  if (ts.isExpressionStatement(stmt)) return isHookCall(stmt.expression)
  if (!ts.isVariableStatement(stmt)) return false
  return stmt.declarationList.declarations.some((d) => {
    const init = d.initializer
    return (
      !!init && (isHookCall(init) || (ts.isAwaitExpression(init) && isHookCall(init.expression)))
    )
  })
}

function isArrowStatement(stmt: ts.Statement): boolean {
  if (!ts.isVariableStatement(stmt)) return false
  return stmt.declarationList.declarations.some((d) => {
    const init = d.initializer
    return !!init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
  })
}

function statementLabel(stmt: ts.Statement): string {
  if (ts.isVariableStatement(stmt)) {
    const d = stmt.declarationList.declarations[0]
    return d && ts.isIdentifier(d.name) ? d.name.text : 'declaration'
  }
  if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
    return stmt.expression.expression.getText()
  }
  return stmt.kind === ts.SyntaxKind.IfStatement ? 'if' : ts.SyntaxKind[stmt.kind]
}

function checkComponentBody(file: string, comp: ComponentDecl) {
  if (!comp.body) return
  let phase: Phase = PHASE.hooks
  let fullReturns = 0
  let hasHooks = false
  let hasArrows = false

  for (const stmt of comp.body.statements) {
    // Nested function declarations: helpers belong at module scope or as arrows; handlers must be arrows.
    if (ts.isFunctionDeclaration(stmt)) {
      const name = stmt.name?.text ?? ''
      report(
        file,
        stmt,
        /^handle[A-Z]/.test(name)
          ? `handler "${name}" must be an arrow function (const ${name} = () => ...)`
          : `nested function "${name}" in ${comp.name}: use a module-scope helper or an arrow`,
      )
      continue
    }

    if (ts.isReturnStatement(stmt)) {
      fullReturns += 1
      if (fullReturns > 1)
        report(
          file,
          stmt,
          `${comp.name} has more than one top-level return: use early-return guards, then a single render return`,
        )
      continue
    }

    let want: Phase
    if (isHookStatement(stmt)) {
      want = PHASE.hooks
      hasHooks = true
    } else if (isArrowStatement(stmt)) {
      want = PHASE.arrows
      hasArrows = true
    } else if (isGuardReturn(stmt)) {
      want = PHASE.earlyReturns
    } else {
      want = PHASE.render
    }

    // A guard may need a value computed just above it: consts are allowed inside the
    // early-returns block (they count as render logic that the guard depends on).
    if (want === PHASE.render && phase === PHASE.earlyReturns) continue
    // ...and a guard may follow such consts, as long as no hook or arrow sits between.
    if (want === PHASE.earlyReturns && phase === PHASE.render) continue
    if (want < phase) {
      report(
        file,
        stmt,
        `"${statementLabel(stmt)}" belongs in ${PHASE_LABEL[want]} but appears after ${PHASE_LABEL[phase]} in ${comp.name}: order is hooks, helpers/handlers, early returns, render logic, return`,
      )
      continue
    }
    phase = want
  }

  if (hasHooks || hasArrows) {
    const text = comp.body.getFullText()
    if (!SECTION_COMMENTS.some((c) => text.includes(c))) {
      report(
        file,
        comp.node,
        `${comp.name} has no section comments (${SECTION_COMMENTS.join(', ')})`,
        'warn',
      )
    }
  }
}

function checkFile(file: string) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n').length
  if (lines > HARD_LOC)
    report(file, 1, `file has ${lines} lines (hard cap ${HARD_LOC}): split into sibling files`)
  else if (lines > SOFT_LOC)
    report(file, 1, `file has ${lines} lines (soft cap ${SOFT_LOC})`, 'warn')

  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  const visitAll = (n: ts.Node) => {
    // `declare global { interface Window {...} }` is the only way to augment globals; allow it.
    if (ts.isInterfaceDeclaration(n) && !isInsideGlobalAugmentation(n)) {
      report(file, n, `interface "${n.name.text}": use type`)
    }
    if (ts.isCallExpression(n)) {
      const callee = n.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : ''
      if (BANNED_CALLS.has(name))
        report(file, n, `${name}() is banned (React Compiler handles memoisation)`)
    }
    ts.forEachChild(n, visitAll)
  }
  visitAll(sf)

  const comps = findComponents(sf)
  for (const c of comps.filter((c) => c.exported)) {
    report(file, c.node, `component "${c.name}" is a named export: use export default`)
  }
  const defaults = comps.filter((c) => c.isDefault)
  for (const c of defaults.slice(1)) {
    report(file, c.node, `second default-exported component "${c.name}": one component per file`)
  }
  for (const c of comps) checkComponentBody(file, c)
}

const files = await collectFiles()
for (const f of files) checkFile(f)

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
for (const f of findings) {
  console.log(`${f.level === 'error' ? 'error' : 'warn '} ${f.file}:${f.line}  ${f.rule}`)
}
const errors = findings.filter((f) => f.level === 'error').length
const warns = findings.length - errors
console.log(`\n${files.length} files checked, ${errors} error(s), ${warns} warning(s)`)
process.exit(errors > 0 ? 1 : 0)
