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
type ComponentDecl = { name: string; node: ts.Node; body: ts.Block | undefined; exported: boolean }

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
        exported: hasExportModifier(stmt),
      })
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !isPascal(decl.name.text) || !decl.initializer) continue
        const init = decl.initializer
        if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && containsJsx(init)) {
          const body = ts.isBlock(init.body) ? init.body : undefined
          out.push({ name: decl.name.text, node: stmt, body, exported: hasExportModifier(stmt) })
        }
      }
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

function checkComponentBody(file: string, comp: ComponentDecl) {
  if (!comp.body) return
  let seenHandler = false
  let seenEarlyReturn = false
  let fullReturns = 0

  for (const stmt of comp.body.statements) {
    // Nested function declarations: helpers belong at module scope; handlers must be arrows.
    if (ts.isFunctionDeclaration(stmt)) {
      const name = stmt.name?.text ?? ''
      if (/^handle[A-Z]/.test(name)) {
        report(
          file,
          stmt,
          `handler "${name}" must be an arrow function (const ${name} = () => ...)`,
        )
      } else {
        report(
          file,
          stmt,
          `nested function "${name}" in ${comp.name}: move helpers to module scope`,
        )
      }
      seenHandler = true
      continue
    }

    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const init = decl.initializer
        const name = ts.isIdentifier(decl.name) ? decl.name.text : ''
        const isHook =
          !!init &&
          (isHookCall(init) || (ts.isAwaitExpression(init) && isHookCall(init.expression)))
        const isArrow = !!init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        if (isHook) {
          if (seenHandler)
            report(
              file,
              stmt,
              `hook "${name}" declared after a handler in ${comp.name}: hooks first`,
            )
          if (seenEarlyReturn)
            report(file, stmt, `hook "${name}" declared after an early return in ${comp.name}`)
        }
        if (isArrow && /^handle[A-Z]/.test(name)) seenHandler = true
      }
      continue
    }

    // Bare hook call as a statement, e.g. useEffect(...)
    if (ts.isExpressionStatement(stmt) && isHookCall(stmt.expression)) {
      const name = ts.isIdentifier(stmt.expression.expression)
        ? stmt.expression.expression.text
        : stmt.expression.expression.getText()
      if (seenHandler)
        report(file, stmt, `hook "${name}" called after a handler in ${comp.name}: hooks first`)
      if (seenEarlyReturn)
        report(file, stmt, `hook "${name}" called after an early return in ${comp.name}`)
      continue
    }

    if (ts.isIfStatement(stmt)) {
      const guardReturns = (s: ts.Statement | undefined): boolean =>
        !!s &&
        (ts.isReturnStatement(s) ||
          (ts.isBlock(s) &&
            s.statements.length === 1 &&
            ts.isReturnStatement(s.statements[0] as ts.Statement)))
      if (guardReturns(stmt.thenStatement)) seenEarlyReturn = true
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
  const [first, ...rest] = comps.filter((c) => c.exported)
  if (first) {
    for (const c of rest) {
      report(
        file,
        c.node,
        `second exported component "${c.name}" (first: "${first.name}"): one component per file`,
      )
    }
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
