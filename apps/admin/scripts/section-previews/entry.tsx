/**
 * Browser half of `bun run section-previews` (see ./run.ts): draws every section the Add panel
 * offers, each with its own default settings and the default theme, one under the other, so
 * the runner can photograph them. Product, collection and blog sections read the neutral
 * stand-ins in ./demo-data. `?mode=dark` draws the dark colours.
 */
import { createBlocksConfig, SECTION_CATEGORIES } from '@commerce/blocks/puck'
import { renderBlock } from '@commerce/blocks/slots'
import { defaultTheme, GROUP_SECTIONS, themeRootAttrs, themeToCss } from '@commerce/core/theme'
import { type Data, resolveAllData } from '@puckeditor/core'
import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { DEMO_ARTICLES, DEMO_COLLECTIONS, DEMO_PRODUCTS } from './demo-data'

declare global {
  interface Window {
    /** Set once every section has rendered: the types that drew something. */
    __previews?: string[]
  }
}

/** The page's own chrome, not sections merchants add. */
const NOT_ADDABLE = new Set(['Header', 'Footer'])
/** Build-your-own containers and elements keep their drawn glyph: alone they are a blank strip. */
const GLYPH_ONLY = new Set(['layout', 'elements'])

const TYPES = [
  ...new Set([
    ...Object.entries(SECTION_CATEGORIES).flatMap(([id, c]) =>
      GLYPH_ONLY.has(id) ? [] : ([...c.components] as string[]),
    ),
    ...Object.values(GROUP_SECTIONS).flat(),
  ]),
].filter((t) => !NOT_ADDABLE.has(t))

const config = createBlocksConfig(async ({ limit }) => DEMO_PRODUCTS.slice(0, limit), {
  loadArticles: async ({ limit }) => DEMO_ARTICLES.slice(0, limit),
  loadCollections: async (handles) =>
    handles.length ? DEMO_COLLECTIONS.slice(0, handles.length) : DEMO_COLLECTIONS,
  loadProduct: async () => DEMO_PRODUCTS[0] ?? null,
})

const DEFAULTS = config.components as Record<string, { defaultProps?: object } | undefined>

/** Empty product and collection handles point at the stand-ins, so those sections show cards. */
function withDemoHandles(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => withDemoHandles(v))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withDemoHandles(v, k)]))
  }
  if (typeof value === 'string' && /handle$/i.test(key) && !value) return 'demo-0'
  return value
}

/** One section failing to draw outside a store leaves only that section without a picture. */
class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

async function main() {
  const dark = new URLSearchParams(location.search).get('mode') === 'dark'
  const style = document.createElement('style')
  style.textContent = themeToCss(defaultTheme)
  document.head.appendChild(style)
  const root = document.documentElement
  for (const [name, value] of Object.entries(themeRootAttrs(defaultTheme))) {
    root.setAttribute(name, value)
  }
  root.setAttribute('data-theme', dark ? 'dark' : 'light')

  const data = (await resolveAllData(
    {
      root: { props: {} },
      content: TYPES.map((type) => ({
        type,
        props: {
          ...(withDemoHandles(DEFAULTS[type]?.defaultProps ?? {}) as object),
          id: type,
        },
      })),
    } as Partial<Data>,
    config as never,
    {},
  )) as Data
  const puck = { isEditing: false, metadata: {} }
  const components = config.components as never

  const host = document.getElementById('previews')
  if (!host) return
  createRoot(host).render(
    data.content.map((item) => (
      <section key={item.type} data-preview={item.type} className="flow-root bg-bg">
        <Guard>{renderBlock(item as never, components, puck)}</Guard>
      </section>
    )),
  )
  await new Promise((r) => setTimeout(r, 1500))
  await document.fonts.ready
  window.__previews = [...document.querySelectorAll<HTMLElement>('[data-preview]')]
    .filter((el) => el.offsetHeight > 8)
    .map((el) => el.dataset.preview ?? '')
}

void main()
