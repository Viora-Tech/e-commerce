// Which rules of our global stylesheets an imported theme's markup actually depends on.
// For each page and viewport: snapshot computed styles of every theme element with our sheets on
// and off, then for every differing (element, property) find the rules in our sheets that set it.
// Also lists custom properties the theme's CSS reads that only we define. Fonts are not seen
// (the computed family name stays the same when a face goes away): see `theme-fonts.ts`.
// Run against a React page (it sets `wc_plain=off` and an answered cookie banner):
//   node scripts/plain-html/theme-css-reliance.mjs <origin> out.json "/,/pages/about" [ours] [check.css]
// then `theme-css-extract.mjs <origin>/ out.json theme.css` and `theme-css-module.mjs *.css`.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../package.json', import.meta.url))
const { chromium } = require('playwright')

const base = process.argv[2] ?? 'https://www.waimers.in'
const out = process.argv[3] ?? 'reliance.json'
const paths = (
  process.argv[4] ??
  '/,/pages/about,/pages/faq,/pages/contact,/pages/reviews,/pages/roadmap,/pages/find-your-match,/pages/hall-of-fame'
).split(',')
const ours = process.argv[5] ?? '/_next/static/'
// Optional: a CSS file injected first in both states, to see what it leaves (verification).
const compatFile = process.argv[6]

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const browser = await chromium.launch()
const result = { rules: {}, vars: {}, keyframes: {}, fonts: {}, unexplained: {} }

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: vp, deviceScaleFactor: 1 })
  // A store with plain HTML on: ask for the React page (the one with our stylesheet).
  // and an answered cookie banner, so our own React banner is not on the page.
  await ctx.addCookies([
    { name: 'wc_plain', value: 'off', url: base },
    { name: 'wc_consent', value: `a0m0.v9.t${Math.floor(Date.now() / 1000)}`, url: base },
  ])
  for (const path of paths) {
    const page = await ctx.newPage()
    await page.goto(base + path, { waitUntil: 'load', timeout: 240000 })
    // Scroll through so reveal observers fire, then back to the top.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 60))
      }
      window.scrollTo(0, 0)
      await new Promise((r) => setTimeout(r, 800))
    })
    const found = await page.evaluate(
      ([ours, compat]) => {
        if (compat) {
          const c = document.createElement('style')
          c.textContent = compat
          document.head.prepend(c)
        }
        const freeze = document.createElement('style')
        freeze.textContent =
          '*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important}'
        document.head.appendChild(freeze)
        const isOurs = (s) => (s.href || '').includes(ours)
        const ourSheets = [...document.styleSheets].filter(isOurs)
        const themeSheets = [...document.styleSheets].filter(
          (s) => !isOurs(s) && s.ownerNode !== freeze,
        )
        // Our React widgets are not theme markup.
        const skip =
          '[data-chat-root],[data-commerce-ours],next-route-announcer,script,style,link,meta,noscript,template'
        const els = [...document.body.querySelectorAll('*')].filter((e) => !e.closest(skip))
        const SKIP_PROPS = /^(transition|animation)-(duration|delay)$|^animation-iteration-count$/
        const take = (e, pseudo) => {
          const cs = getComputedStyle(e, pseudo)
          if (pseudo && cs.content === 'none') return null
          const o = {}
          for (let i = 0; i < cs.length; i++) {
            const p = cs[i]
            if (!SKIP_PROPS.test(p)) o[p] = cs.getPropertyValue(p)
          }
          return o
        }
        // Differences only, in chunks: our sheets on, read; off, read; compare.
        const diffs = []
        const CHUNK = 250
        for (let at = 0; at < els.length; at += CHUNK) {
          const part = els.slice(at, at + CHUNK)
          const on = part.map((e) => [take(e, null), take(e, '::before'), take(e, '::after')])
          for (const s of ourSheets) s.disabled = true
          part.forEach((e, j) => {
            const off = [take(e, null), take(e, '::before'), take(e, '::after')]
            ;['el', 'before', 'after'].forEach((name, k) => {
              const x = on[j][k] || {}
              const y = off[k] || {}
              const props = {}
              for (const p of new Set([...Object.keys(x), ...Object.keys(y)]))
                if (x[p] !== y[p]) props[p] = [y[p] ?? '(none)', x[p] ?? '(none)']
              if (Object.keys(props).length) diffs.push({ e, part: name, props })
            })
          })
          for (const s of ourSheets) s.disabled = false
        }

        // Every style rule in our sheets, flattened, with its at-rule wrappers.
        const flat = []
        const walk = (rules, wrap) => {
          for (const r of rules) {
            if (r instanceof CSSStyleRule) {
              flat.push({ rule: r, wrap })
              if (r.cssRules?.length) walk(r.cssRules, wrap)
            } else if (r instanceof CSSMediaRule) {
              walk(r.cssRules, [...wrap, `@media ${r.conditionText}`])
            } else if (r instanceof CSSSupportsRule) {
              walk(r.cssRules, [...wrap, `@supports ${r.conditionText}`])
            } else if (r instanceof CSSLayerBlockRule) {
              walk(r.cssRules, [...wrap, `@layer ${r.name}`])
            } else if (r.cssRules) {
              walk(r.cssRules, wrap)
            }
          }
        }
        for (const s of ourSheets) {
          try {
            walk(s.cssRules, [])
          } catch {}
        }
        const sets = (style, prop) => {
          if (style.getPropertyValue(prop) !== '') return true
          // A shorthand that covers the longhand (margin -> margin-top...).
          for (let i = 0; i < style.length; i++) if (prop.startsWith(`${style[i]}-`)) return true
          for (const sh of [
            'inset',
            'font',
            'background',
            'border',
            'outline',
            'grid',
            'flex',
            'transition',
            'animation',
            'text-decoration',
            'list-style',
            'overflow',
            'place-items',
            'gap',
            'columns',
          ])
            if (prop.startsWith(sh) && style.getPropertyValue(sh) !== '') return true
          return false
        }
        const matches = (el, sel, pseudo) => {
          const s = pseudo ? sel.replace(/::?(before|after)\b/g, '') : sel
          if (pseudo && s === sel) return false
          try {
            return el.matches(s || '*')
          } catch {
            return false
          }
        }
        const hit = {}
        const unexplained = {}
        for (const { e, part, props } of diffs) {
          {
            const pseudo = part === 'el' ? null : part
            const cand = flat.filter(
              ({ rule, wrap }) =>
                matches(e, rule.selectorText, pseudo) &&
                !wrap.some((w) => w.startsWith('@media') && !matchMedia(w.slice(7)).matches),
            )
            for (const prop of Object.keys(props)) {
              const bv = props[prop][0]
              const av = props[prop][1]
              let explained = false
              for (const { rule, wrap } of cand) {
                if (!sets(rule.style, prop)) continue
                explained = true
                const key = `${wrap.join(' ')} ${rule.selectorText}`.trim()
                hit[key] ??= { wrap, selector: rule.selectorText, props: {}, sample: '' }
                hit[key].props[prop] = `${bv} -> ${av}`
                if (!hit[key].sample)
                  hit[key].sample =
                    `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 3).join('.')}${pseudo ? `::${pseudo}` : ''}`
              }
              if (!explained) {
                const k = `${prop}`
                unexplained[k] ??= []
                if (unexplained[k].length < 4)
                  unexplained[k].push(
                    `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 3).join('.')}${pseudo ? `::${pseudo}` : ''}: ${bv} -> ${av}`,
                  )
              }
            }
          }
        }

        // Custom properties, keyframes and fonts the theme uses that only our sheets define.
        const text = (sheets) =>
          sheets
            .map((s) => {
              try {
                return [...s.cssRules].map((r) => r.cssText).join('\n')
              } catch {
                return ''
              }
            })
            .join('\n')
        const themeText =
          text(themeSheets) +
          [...document.querySelectorAll('[style]')]
            .filter((e) => !e.closest(skip))
            .map((e) => e.getAttribute('style'))
            .join(';')
        const ourText = text(ourSheets)
        const used = new Set([...themeText.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]))
        const defined = (t) =>
          new Set([...t.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)].map((m) => m[1]))
        const themeDefined = defined(themeText)
        const ourDefined = defined(ourText)
        const vars = [...used].filter((v) => ourDefined.has(v) && !themeDefined.has(v))
        const kfUsed = new Set(
          [...themeText.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)].flatMap((m) =>
            m[1].split(/[\s,]+/),
          ),
        )
        const kfOurs = [...ourText.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])
        const kfTheme = new Set([...themeText.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]))
        const keyframes = kfOurs.filter((k) => kfUsed.has(k) && !kfTheme.has(k))
        return {
          hit,
          unexplained,
          vars,
          keyframes,
          count: els.length,
          ourSheets: ourSheets.map((s) => s.href),
        }
      },
      [ours, compatFile ? readFileSync(compatFile, 'utf8') : ''],
    )
    for (const [k, v] of Object.entries(found.hit)) {
      result.rules[k] ??= { ...v, pages: [] }
      Object.assign(result.rules[k].props, v.props)
      result.rules[k].pages.push(`${vp.name}${path}`)
    }
    for (const [k, v] of Object.entries(found.unexplained))
      result.unexplained[k] = [...(result.unexplained[k] ?? []), ...v].slice(0, 6)
    for (const v of found.vars) result.vars[v] = (result.vars[v] ?? 0) + 1
    for (const v of found.keyframes) result.keyframes[v] = (result.keyframes[v] ?? 0) + 1
    console.log(
      vp.name,
      path,
      'elements',
      found.count,
      'rules',
      Object.keys(found.hit).length,
      'vars',
      found.vars.length,
      found.ourSheets.length,
      'our sheets',
    )
    await page.close()
  }
  await ctx.close()
}
await browser.close()
writeFileSync(out, JSON.stringify(result, null, 2))
console.log(
  'rules',
  Object.keys(result.rules).length,
  'vars',
  Object.keys(result.vars).length,
  'keyframes',
  Object.keys(result.keyframes),
)
