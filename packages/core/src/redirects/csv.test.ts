/** SOURCE OF TRUTH: tests for the redirects CSV format (Shopify's two columns) */
import { describe, expect, it } from 'vitest'
import { parseRedirectsCsv, REDIRECT_CSV_MAX_ROWS, redirectsToCsv } from './csv'

describe('redirects CSV', () => {
  it('writes Shopify headers and quotes only what needs it', () => {
    expect(
      redirectsToCsv([
        { path: '/products/old', target: '/products/new' },
        { path: '/pages/a,b', target: 'https://x.example/?q="1"' },
      ]),
    ).toBe(
      'Redirect from,Redirect to\r\n/products/old,/products/new\r\n"/pages/a,b","https://x.example/?q=""1"""',
    )
  })

  it('reads a Shopify export, normalising paths the way the dialog does', () => {
    const r = parseRedirectsCsv(
      '\uFEFFRedirect from,Redirect to\n/Products/Old-Tee/,/products/tee\n\npages/about-us,https://shop.example/pages/about\n',
    )
    expect(r.problems).toEqual([])
    expect(r.rows).toEqual([
      { line: 2, path: '/products/old-tee', target: '/products/tee' },
      { line: 4, path: '/pages/about-us', target: 'https://shop.example/pages/about' },
    ])
  })

  it('works without a header row', () => {
    expect(parseRedirectsCsv('/a,/b').rows).toEqual([{ line: 1, path: '/a', target: '/b' }])
  })

  it('skips bad rows with their line and reason, and keeps the last of a repeated path', () => {
    const r = parseRedirectsCsv(
      [
        'Redirect from,Redirect to',
        '/a,/b',
        '/only-one-column',
        '/,/home',
        '/loop,/LOOP',
        '/a,/c',
        '/x,https://bad url',
      ].join('\n'),
    )
    expect(r.rows).toEqual([{ line: 6, path: '/a', target: '/c' }])
    expect(r.problems.map((p) => p.line)).toEqual([2, 3, 4, 5, 7])
    expect(r.problems[0]?.reason).toBe('/a appears again on line 6; that row is used')
    expect(r.problems[1]?.reason).toBe('Needs two columns: Redirect from, Redirect to')
    expect(r.problems[3]?.reason).toBe('A path cannot redirect to itself')
  })

  it(`stops after ${REDIRECT_CSV_MAX_ROWS} rows`, () => {
    const lines = Array.from({ length: REDIRECT_CSV_MAX_ROWS + 3 }, (_, i) => `/p${i},/t`)
    const r = parseRedirectsCsv(lines.join('\n'))
    expect(r.rows).toHaveLength(REDIRECT_CSV_MAX_ROWS)
    expect(r.problems).toEqual([
      {
        line: REDIRECT_CSV_MAX_ROWS + 1,
        reason: `Only ${REDIRECT_CSV_MAX_ROWS} redirects fit in one file`,
      },
    ])
  })

  it('round-trips its own export', () => {
    const rows = [
      { path: '/collections/old', target: '/collections/new' },
      { path: '/pages/x', target: 'https://example.com/a,b' },
    ]
    expect(
      parseRedirectsCsv(redirectsToCsv(rows)).rows.map(({ path, target }) => ({ path, target })),
    ).toEqual(rows)
  })
})
