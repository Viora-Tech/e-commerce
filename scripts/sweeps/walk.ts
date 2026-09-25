/**
 * Shared walker for the guardrail sweeps (`scripts/sweeps/*.test.ts`, run via
 * `bun run test:sweeps`). Lists repo source files and parses their imports/exports
 * with the TypeScript compiler API — the same approach `scripts/check-components.ts`
 * already uses, so this stays consistent with the rest of the tooling.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '../..')

/**
 * Packages whose server entries must never be VALUE-imported by a `'use client'` module
 * (types are fine). Used by the client-imports-server sweep. `@commerce/core`/`@commerce/db`
 * are already enforced by `scripts/check-components.ts` as part of `bun run lint`; this
 * list extends that to the rest of the server-only surface (auth, storage, payments,
 * shipping connectors, api).
 */
export const SERVER_ONLY_PACKAGES = new Set([
  '@commerce/core',
  '@commerce/db',
  '@commerce/auth',
  '@commerce/storage',
  '@commerce/storage-r2',
  '@commerce/payments',
  '@commerce/payments-razorpay',
  '@commerce/shipping',
  '@commerce/shipping-delhivery',
  '@commerce/shipping-shiprocket',
  '@commerce/api',
])

const DEFAULT_IGNORE = [
  '/node_modules/',
  '/.next/',
  '/dist/',
  '/.turbo/',
  '/__generated__/',
  '/.claude/',
]

function walkDir(dir: string, out: string[]): void {
  let entries: import('node:fs').Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    const relNorm = `/${toRel(full)}/`
    if (DEFAULT_IGNORE.some((seg) => relNorm.includes(seg))) continue
    if (entry.isDirectory()) {
      walkDir(full, out)
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  }
}

/** All `.ts`/`.tsx` files under the given repo-relative roots (e.g. `apps`, `packages`). */
export async function listFiles(
  roots: string[],
  opts: { includeTests?: boolean } = {},
): Promise<string[]> {
  const files = new Set<string>()
  for (const root of roots) {
    const found: string[] = []
    walkDir(path.join(ROOT, root), found)
    for (const full of found) {
      const norm = full.replaceAll('\\', '/')
      if (norm.endsWith('.d.ts')) continue
      if (!opts.includeTests && /\.test\.tsx?$/.test(norm)) continue
      files.add(full)
    }
  }
  return [...files].sort()
}

export function toRel(file: string): string {
  return path.relative(ROOT, file).replaceAll('\\', '/')
}

export function loadSourceFile(file: string): ts.SourceFile {
  const text = readFileSync(file, 'utf8')
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

export type ImportInfo = {
  specifier: string
  line: number
  /** Brings in a runtime value (not a type-only import/re-export or side-effect-free type). */
  hasValue: boolean
  /** Raw source text of the import/export statement, for cheap "is this name mentioned" checks. */
  text: string
  node: ts.ImportDeclaration | ts.ExportDeclaration
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
}

/** Whether an import/re-export statement brings in a runtime value rather than only types. */
export function bringsValues(stmt: ts.ImportDeclaration | ts.ExportDeclaration): boolean {
  if (ts.isExportDeclaration(stmt)) {
    if (stmt.isTypeOnly) return false
    const clause = stmt.exportClause
    return !clause || !ts.isNamedExports(clause) || clause.elements.some((e) => !e.isTypeOnly)
  }
  const clause = stmt.importClause
  if (!clause) return true // side-effect import: `import 'foo'`
  if (clause.isTypeOnly) return false
  if (clause.name) return true
  const bindings = clause.namedBindings
  if (!bindings) return false
  return ts.isNamespaceImport(bindings) || bindings.elements.some((e) => !e.isTypeOnly)
}

/** All import/re-export statements in a file, with their module specifier. */
export function parseImports(sf: ts.SourceFile): ImportInfo[] {
  const out: ImportInfo[] = []
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) && !ts.isExportDeclaration(stmt)) continue
    const spec = stmt.moduleSpecifier
    if (!spec || !ts.isStringLiteral(spec)) continue
    out.push({
      specifier: spec.text,
      line: lineOf(sf, stmt),
      hasValue: bringsValues(stmt),
      text: stmt.getText(sf),
      node: stmt,
    })
  }
  return out
}

export function isClientDirective(sf: ts.SourceFile): boolean {
  const first = sf.statements[0]
  return (
    !!first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'use client'
  )
}

export type ExportedValue = { name: string; line: number; kind: 'function' | 'const' | 'class' }

/** Top-level exported function/const/class declarations (types are exempt). */
export function exportedValues(sf: ts.SourceFile): ExportedValue[] {
  const out: ExportedValue[] = []
  const isExported = (node: ts.Node) =>
    (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && isExported(stmt)) {
      out.push({ name: stmt.name.text, line: lineOf(sf, stmt), kind: 'function' })
    }
    if (ts.isClassDeclaration(stmt) && stmt.name && isExported(stmt)) {
      out.push({ name: stmt.name.text, line: lineOf(sf, stmt), kind: 'class' })
    }
    if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          out.push({ name: decl.name.text, line: lineOf(sf, stmt), kind: 'const' })
        }
      }
    }
  }
  return out
}

/** `dangerouslySetInnerHTML={...}` usages in a file, by line. */
export function findDangerousHtml(sf: ts.SourceFile): number[] {
  const lines: number[] = []
  const visit = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && n.name.getText() === 'dangerouslySetInnerHTML') {
      lines.push(lineOf(sf, n))
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return lines
}

/** `new Intl.NumberFormat(...)` / `Intl.NumberFormat(...)` call sites, by line. */
export function findIntlNumberFormat(sf: ts.SourceFile): number[] {
  const lines: number[] = []
  const isIntlNumberFormat = (expr: ts.Expression): boolean =>
    ts.isPropertyAccessExpression(expr) &&
    expr.name.text === 'NumberFormat' &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === 'Intl'
  const visit = (n: ts.Node) => {
    if (ts.isNewExpression(n) && isIntlNumberFormat(n.expression)) lines.push(lineOf(sf, n))
    if (ts.isCallExpression(n) && isIntlNumberFormat(n.expression)) lines.push(lineOf(sf, n))
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return lines
}

/** Hex colour literals (`#fff`, `#a1b2c3`) inside string/template literals, by line. */
export function findHexColours(sf: ts.SourceFile): number[] {
  const lines: number[] = []
  const re = /#[0-9a-fA-F]{3,8}\b/
  const visit = (n: ts.Node) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && re.test(n.text)) {
      lines.push(lineOf(sf, n))
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return lines
}
