// From reliance.json (theme-css-reliance.mjs), write the declarations of our stylesheets that the theme's
// markup depends on, wrapped in their at-rules, as one CSS file. Reads the rules from the CSSOM of one
// page that loads our sheets, so selectors and wrappers match the analysis exactly.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../package.json', import.meta.url))
const { chromium } = require('playwright')
const [url, input, output, ours = '/_next/static/'] = process.argv.slice(2)
const reliance = JSON.parse(readFileSync(input, 'utf8'))
// Values that only follow from layout, not from a declaration a theme needs.
const NOISE = new Set(['transform-origin', 'perspective-origin'])
// Tailwind's own variable defaults, and the heading rise's hidden state: it waits for a reveal
// script only some themes have (Dawn's headings stayed invisible on the React page).
const SKIP_KEY = /^@layer properties|html\.js main :is\(h1, h2, h3\)/
const wanted = Object.entries(reliance.rules)
  .filter(([key]) => !SKIP_KEY.test(key))
  .map(([key, v]) => ({
    key,
    props: Object.keys(v.props).filter((p) => !NOISE.has(p)),
  }))

const browser = await chromium.launch()
const page = await browser.newPage()
await page.context().addCookies([{ name: 'wc_plain', value: 'off', url }])
await page.goto(url, { waitUntil: 'load', timeout: 240000 })
const css = await page.evaluate(
  ({ wanted, ours, themeVars }) => {
    const want = new Map(wanted.map((w) => [w.key, w.props]))
    const out = []
    const walk = (rules, wrap) => {
      for (const r of rules) {
        if (r instanceof CSSStyleRule) {
          const key = `${wrap.join(' ')} ${r.selectorText}`.trim()
          const props = want.get(key)
          if (props?.length) {
            const decls = new Map()
            for (const p of props) {
              let name = r.style.getPropertyValue(p) !== '' ? p : null
              if (!name) {
                // The shorthand the rule wrote (a shorthand with var() leaves its longhands empty
                // in the CSSOM): the longest prefix first (border-bottom before border), then the
                // shorthands that are not prefixes (border-radius, inset, gap...).
                const parts = p.split('-')
                const prefixes = parts
                  .slice(1)
                  .map((_, i) => parts.slice(0, parts.length - 1 - i).join('-'))
                const special = [
                  /radius$/.test(p) && 'border-radius',
                  /^(top|right|bottom|left|inset-)/.test(p) && 'inset',
                  /gap$/.test(p) && 'gap',
                  /^overscroll-behavior/.test(p) && 'overscroll-behavior',
                  /^place-|^align-|^justify-/.test(p) && `place-${p.split('-').pop()}`,
                  /^text-wrap/.test(p) && 'text-wrap',
                  /-style$/.test(p) && /^border/.test(p) && 'border-style',
                  /-width$/.test(p) && /^border/.test(p) && 'border-width',
                  /-color$/.test(p) && /^border/.test(p) && 'border-color',
                ].filter(Boolean)
                for (const sh of [...special, ...prefixes.filter((x) => x)])
                  if (!name && r.style.getPropertyValue(sh) !== '') name = sh
              }
              if (!name) continue
              const value = r.style.getPropertyValue(name)
              if (!value) continue
              const imp = r.style.getPropertyPriority(name) ? ' !important' : ''
              decls.set(name, `${name}:${value}${imp}`)
            }
            if (decls.size) {
              const body = `${r.selectorText}{${[...decls.values()].join(';')}}`
              out.push(wrap.reduceRight((inner, w) => `${w}{${inner}}`, body))
            }
          }
          if (r.cssRules?.length) walk(r.cssRules, wrap)
        } else if (r instanceof CSSMediaRule)
          walk(r.cssRules, [...wrap, `@media ${r.conditionText}`])
        else if (r instanceof CSSSupportsRule)
          walk(r.cssRules, [...wrap, `@supports ${r.conditionText}`])
        else if (r instanceof CSSLayerBlockRule) walk(r.cssRules, [...wrap, `@layer ${r.name}`])
        else if (r.cssRules) walk(r.cssRules, wrap)
      }
    }
    for (const s of document.styleSheets) if ((s.href || '').includes(ours)) walk(s.cssRules, [])
    // Custom properties the kept declarations read that the theme does not define: ours, from the
    // rules that define them (:root, html), following any they read in turn.
    const isOurs = (s) => (s.href || '').includes(ours)
    const themeText = [...document.styleSheets]
      .filter((s) => !isOurs(s))
      .map((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText).join('\n')
        } catch {
          return ''
        }
      })
      .join('\n')
    const refs = (t) => [...t.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1])
    const seen = new Set()
    const queue = [...refs(out.join('\n')), ...themeVars]
    const defs = []
    const missing = []
    while (queue.length) {
      const name = queue.shift()
      if (seen.has(name) || name.startsWith('--tw-')) continue
      seen.add(name)
      if (themeText.includes(`${name}:`)) continue
      let any = false
      const look = (rules, wrap) => {
        for (const r of rules) {
          if (
            r instanceof CSSStyleRule &&
            r.style.getPropertyValue(name) !== '' &&
            /^(:root|html)\b/.test(r.selectorText)
          ) {
            const value = r.style.getPropertyValue(name).trim()
            defs.push(
              wrap.reduceRight(
                (inner, w) => `${w}{${inner}}`,
                `${r.selectorText}{${name}:${value}}`,
              ),
            )
            queue.push(...refs(value))
            any = true
          } else if (r instanceof CSSMediaRule)
            look(r.cssRules, [...wrap, `@media ${r.conditionText}`])
          else if (r instanceof CSSSupportsRule)
            look(r.cssRules, [...wrap, `@supports ${r.conditionText}`])
          else if (r instanceof CSSLayerBlockRule) look(r.cssRules, [...wrap, `@layer ${r.name}`])
        }
      }
      for (const s of document.styleSheets) if (isOurs(s)) look(s.cssRules, [])
      if (!any) missing.push(name)
    }
    out.unshift(...defs)
    if (missing.length) out.push(`/* not defined by us at :root: ${missing.join(' ')} */`)
    // Keyframes an included declaration names.
    const text = out.join('\n')
    for (const s of document.styleSheets) {
      if (!(s.href || '').includes(ours)) continue
      for (const r of s.cssRules)
        if (
          r instanceof CSSKeyframesRule &&
          new RegExp(`animation(-name)?:[^;}]*\\b${r.name}\\b`).test(text)
        )
          out.push(r.cssText)
    }
    return out
  },
  { wanted, ours, themeVars: Object.keys(reliance.vars ?? {}) },
)
await browser.close()
// Same rule twice (two sheets) once only.
const unique = [...new Set(css)]
writeFileSync(output, unique.join('\n'))
console.log('rules', unique.length, 'bytes', unique.join('\n').length)
