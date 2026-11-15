/**
 * Draws every `public/diagrams/<name>.excalidraw` as `<name>.svg` (light) and `<name>.dark.svg`
 * (dark), in the same hand-drawn style Excalidraw uses: both are drawn with Rough.js (MIT), the
 * library Excalidraw itself draws with, from each element's own seed, roughness and stroke.
 *
 * The `.excalidraw` file is the source. To change a diagram: open it on excalidraw.com
 * (Open → pick the file), edit, save it back over the same file (Save to disk), then run
 * `bun run --cwd apps/docs diagrams`. Supports rectangles, ellipses, diamonds, arrows, lines,
 * free drawing, text and frames; images and embeds are skipped.
 *
 * The dark file applies Excalidraw's own dark mode to every colour (invert 93%, then hue-rotate
 * 180 degrees), so a diagram reads the same in both themes without a second drawing.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import rough from 'roughjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'public', 'diagrams')
const PAD = 24

const FONTS = {
  1: "Virgil, Excalifont, 'Segoe Print', 'Comic Sans MS', cursive",
  2: 'Helvetica, Arial, sans-serif',
  3: "'Cascadia Code', Consolas, ui-monospace, monospace",
  5: "Excalifont, Virgil, 'Segoe Print', 'Comic Sans MS', cursive",
  6: "Nunito, 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif",
  8: "'Comic Shanns', 'Comic Sans MS', cursive",
}

const escapeXml = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/* ---- colours ------------------------------------------------------------------------------ */

const NAMED = { transparent: null, black: '#000000', white: '#ffffff' }

function parseHex(color) {
  if (!color || color === 'transparent') return null
  if (NAMED[color] !== undefined) return parseHex(NAMED[color])
  let hex = color.replace('#', '')
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('')
  if (hex.length === 8) hex = hex.slice(0, 6)
  const n = Number.parseInt(hex, 16)
  if (Number.isNaN(n)) return null
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (rgb) =>
  `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

/** CSS `invert(93%) hue-rotate(180deg)`, the filter Excalidraw's dark theme puts on the canvas. */
function darkColor(color) {
  const rgb = parseHex(color)
  if (!rgb) return color
  const inv = rgb.map((v) => 0.93 * (255 - v) + 0.07 * v)
  const cos = Math.cos(Math.PI)
  const sin = Math.sin(Math.PI)
  const m = [
    0.213 + cos * 0.787 - sin * 0.213,
    0.715 - cos * 0.715 - sin * 0.715,
    0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143,
    0.715 + cos * 0.285 + sin * 0.14,
    0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787,
    0.715 - cos * 0.715 + sin * 0.715,
    0.072 + cos * 0.928 + sin * 0.072,
  ]
  const [r, g, b] = inv
  return toHex([
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ])
}

/* ---- shapes ------------------------------------------------------------------------------- */

function roughOptions(el, paint) {
  const dashed = el.strokeStyle === 'dashed'
  const dotted = el.strokeStyle === 'dotted'
  const fill = paint(el.backgroundColor)
  return {
    seed: el.seed,
    roughness: el.roughness ?? 1,
    stroke: paint(el.strokeColor),
    strokeWidth: el.strokeWidth ?? 2,
    fillWeight: (el.strokeWidth ?? 2) / 2,
    hachureGap: (el.strokeWidth ?? 2) * 4,
    disableMultiStroke: dashed || dotted,
    strokeLineDash: dashed ? [8, 8 + (el.strokeWidth ?? 2)] : dotted ? [1.5, 6] : undefined,
    ...(fill && el.backgroundColor !== 'transparent'
      ? { fill, fillStyle: el.fillStyle ?? 'hachure' }
      : {}),
    preserveVertices: (el.roughness ?? 1) < 2,
  }
}

/** Excalidraw's corner radius for a rounded rectangle ("adaptive radius"). */
function cornerRadius(el) {
  if (!el.roundness) return 0
  const size = Math.min(el.width, el.height)
  if (el.roundness.type === 3) return Math.min(32, size * 0.25)
  return size * 0.25
}

function roundedRectPath(x, y, w, h, r) {
  return `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y}, ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h}, ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h}, ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y}, ${x + r} ${y}`
}

function arrowheadLines(el, points) {
  const heads = []
  const add = (tip, from) => {
    const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0])
    const len = Math.min(16, Math.hypot(tip[0] - from[0], tip[1] - from[1]) / 2)
    for (const side of [-1, 1]) {
      const a = angle + Math.PI + (side * Math.PI) / 8
      heads.push([tip, [tip[0] + Math.cos(a) * len, tip[1] + Math.sin(a) * len]])
    }
  }
  if (points.length < 2) return heads
  if (el.endArrowhead) add(points[points.length - 1], points[points.length - 2])
  if (el.startArrowhead) add(points[0], points[1])
  return heads
}

function drawablePaths(gen, drawable) {
  return gen
    .toPaths(drawable)
    .map(
      (p) =>
        `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill ?? 'none'}"${
          drawable.options.strokeLineDash && p.fill === 'none'
            ? ` stroke-dasharray="${drawable.options.strokeLineDash.join(' ')}"`
            : ''
        } stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('')
}

function shapeSvg(gen, el, paint) {
  const o = roughOptions(el, paint)
  const { x, y, width: w, height: h } = el
  switch (el.type) {
    case 'rectangle': {
      const r = cornerRadius(el)
      return drawablePaths(
        gen,
        r ? gen.path(roundedRectPath(x, y, w, h, r), o) : gen.rectangle(x, y, w, h, o),
      )
    }
    case 'ellipse':
      return drawablePaths(gen, gen.ellipse(x + w / 2, y + h / 2, w, h, o))
    case 'diamond':
      return drawablePaths(
        gen,
        gen.polygon(
          [
            [x + w / 2, y],
            [x + w, y + h / 2],
            [x + w / 2, y + h],
            [x, y + h / 2],
          ],
          o,
        ),
      )
    case 'arrow':
    case 'line':
    case 'freedraw': {
      const pts = (el.points ?? []).map(([px, py]) => [x + px, y + py])
      if (pts.length < 2) return ''
      const lineOpts = { ...o, fill: undefined, fillStyle: undefined }
      const body =
        el.type === 'freedraw'
          ? `<path d="M ${pts.map((p) => p.join(' ')).join(' L ')}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
          : drawablePaths(
              gen,
              el.roundness && pts.length > 2
                ? gen.curve(pts, lineOpts)
                : gen.linearPath(pts, lineOpts),
            )
      const heads = el.type === 'arrow' ? arrowheadLines(el, pts) : []
      const headOpts = { ...lineOpts, strokeLineDash: undefined, disableMultiStroke: false }
      return (
        body +
        heads
          .map(([a, b]) => drawablePaths(gen, gen.line(a[0], a[1], b[0], b[1], headOpts)))
          .join('')
      )
    }
    case 'frame':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="${paint('#bbbbbb')}" stroke-width="1"/>${
        el.name
          ? `<text x="${x}" y="${y - 8}" font-family="${FONTS[6]}" font-size="14" fill="${paint('#868e96')}">${escapeXml(el.name)}</text>`
          : ''
      }`
    default:
      return ''
  }
}

function textSvg(el, paint, background, arrowIds) {
  const lines = String(el.text ?? '').split('\n')
  const size = el.fontSize ?? 20
  const lineHeight = size * (el.lineHeight ?? 1.25)
  const anchor = { left: 'start', center: 'middle', right: 'end' }[el.textAlign ?? 'left']
  const tx =
    el.textAlign === 'center'
      ? el.x + el.width / 2
      : el.textAlign === 'right'
        ? el.x + el.width
        : el.x
  const backing =
    el.containerId && arrowIds.has(el.containerId)
      ? `<rect x="${el.x - 4}" y="${el.y - 2}" width="${el.width + 8}" height="${el.height + 4}" rx="4" fill="${background}"/>`
      : ''
  const spans = lines
    .map(
      (line, i) =>
        `<text xml:space="preserve" x="${tx}" y="${el.y + i * lineHeight + lineHeight / 2}" dominant-baseline="central" text-anchor="${anchor}" font-family="${FONTS[el.fontFamily] ?? FONTS[6]}" font-size="${size}" fill="${paint(el.strokeColor)}">${escapeXml(line)}</text>`,
    )
    .join('')
  return backing + spans
}

function bounds(elements) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const el of elements) {
    const pts =
      el.points && el.points.length > 0
        ? el.points.map(([px, py]) => [el.x + px, el.y + py])
        : [
            [el.x, el.y],
            [el.x + el.width, el.y + el.height],
          ]
    for (const [px, py] of pts) {
      minX = Math.min(minX, px)
      minY = Math.min(minY, py)
      maxX = Math.max(maxX, px)
      maxY = Math.max(maxY, py)
    }
    if (el.type === 'frame') minY = Math.min(minY, el.y - 24)
  }
  return {
    minX: minX - PAD,
    minY: minY - PAD,
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
  }
}

function render(scene, dark) {
  const paint = dark ? darkColor : (c) => c
  const background = paint(scene.appState?.viewBackgroundColor ?? '#ffffff')
  const elements = scene.elements.filter((el) => !el.isDeleted && el.type !== 'image')
  const arrowIds = new Set(elements.filter((el) => el.type === 'arrow').map((el) => el.id))
  const gen = rough.generator()
  const box = bounds(elements)
  const body = elements
    .map((el) => {
      const inner =
        el.type === 'text' ? textSvg(el, paint, background, arrowIds) : shapeSvg(gen, el, paint)
      const opacity = (el.opacity ?? 100) < 100 ? ` opacity="${el.opacity / 100}"` : ''
      const rotate = el.angle
        ? ` transform="rotate(${(el.angle * 180) / Math.PI} ${el.x + el.width / 2} ${el.y + el.height / 2})"`
        : ''
      return opacity || rotate ? `<g${opacity}${rotate}>${inner}</g>` : inner
    })
    .join('\n')
  const titleEl = elements
    .filter((el) => el.type === 'text' && !el.containerId)
    .sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0))[0]
  const title = escapeXml(titleEl?.text?.replaceAll('\n', ' ') ?? 'Diagram')
  const w = Math.ceil(box.width)
  const h = Math.ceil(box.height)
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="${box.minX} ${box.minY} ${w} ${h}" width="${w}" height="${h}">
<title>${title}</title>
<rect x="${box.minX}" y="${box.minY}" width="${w}" height="${h}" fill="${background}"/>
${body}
</svg>
`
}

const files = readdirSync(dir).filter((f) => f.endsWith('.excalidraw'))
for (const file of files) {
  const scene = JSON.parse(readFileSync(join(dir, file), 'utf8'))
  if (scene.type !== 'excalidraw' || !Array.isArray(scene.elements)) {
    throw new Error(`${file} is not an Excalidraw file`)
  }
  const name = file.replace(/\.excalidraw$/, '')
  writeFileSync(join(dir, `${name}.svg`), render(scene, false))
  writeFileSync(join(dir, `${name}.dark.svg`), render(scene, true))
}
console.log(`Drew ${files.length} diagrams.`)
