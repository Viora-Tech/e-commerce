import {
  DESIGN_MERGE_TAGS,
  type DesignMergeTag,
  discountMjml,
  type EmailBrand,
  type EmailDesign,
  escapeHtml,
  footerMjml,
  logoMjml,
  productGridMjml,
  socialMjml,
  starterMjml,
} from '@commerce/core/marketing'
import grapesjs, { type AssetsCustomData, type Component, type Editor } from 'grapesjs'
import mjmlPlugin from 'grapesjs-mjml'
import type { emailBuilderContent } from '@/data/email-builder'

/**
 * GrapesJS (BSD-3-Clause) with the grapesjs-mjml preset (BSD-3-Clause), set up for store
 * emails: MJML's email-safe blocks, our store blocks (logo, products, discount, socials,
 * footer), a merge-tag picker in the text toolbar and the media library for images.
 */

type Copy = typeof emailBuilderContent

/** Store blocks that ask for data when dropped; the placeholder is replaced with the pick. */
export type PickRequest =
  | { kind: 'products'; component: Component; columns: 1 | 2 | 3 }
  | { kind: 'discount'; component: Component }
  /** An image or button asked to link to a product or collection page. */
  | { kind: 'link'; component: Component }

export type EmailEditorOptions = {
  container: HTMLElement
  design: EmailDesign | null
  brand: EmailBrand
  copy: Copy
  onPick: (request: PickRequest) => void
  onPickImage: (data: AssetsCustomData) => void
}

/** MJML's own blocks we keep (the rest, like carousels and accordions, break in Outlook). */
const MJML_BLOCKS = [
  'mj-1-column',
  'mj-2-columns',
  'mj-3-columns',
  'mj-text',
  'mj-image',
  'mj-button',
  'mj-divider',
  'mj-spacer',
] as const

const SAMPLE = { title: 'Product', priceLabel: '₹999', imageUrl: null, handle: 'product' }

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`

const ICONS = {
  logo: icon('<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/>'),
  card: icon('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 13h12M9 16h6"/>'),
  grid: icon(
    '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  ),
  discount: icon(
    '<path d="M3 9V5h18v4a3 3 0 0 0 0 6v4H3v-4a3 3 0 0 0 0-6z"/><path d="M10 9h.01M14 15h.01M15 9l-6 6"/>',
  ),
  social: icon(
    '<circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 11l8-4M8 13l8 4"/>',
  ),
  footer: icon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 16h18M7 19h10"/>'),
}

function labelFor(id: string, copy: Copy): { label: string; category: string } | null {
  const b = copy.blocks
  const c = copy.categories
  const map: Record<string, { label: string; category: string }> = {
    'mj-1-column': { label: b.oneColumn, category: c.layout },
    'mj-2-columns': { label: b.twoColumns, category: c.layout },
    'mj-3-columns': { label: b.threeColumns, category: c.layout },
    'mj-spacer': { label: b.spacer, category: c.layout },
    'mj-divider': { label: b.divider, category: c.layout },
    'mj-text': { label: b.text, category: c.content },
    'mj-image': { label: b.image, category: c.content },
    'mj-button': { label: b.button, category: c.content },
  }
  return map[id] ?? null
}

/** The merge-tag dropdown in the rich-text toolbar; picking a tag types `{tag}` at the caret. */
function mergeTagSelect(copy: Copy): string {
  const options = DESIGN_MERGE_TAGS.map(
    (t: DesignMergeTag) => `<option value="${t}">${escapeHtml(copy.mergeTags[t])}</option>`,
  ).join('')
  return `<select class="gjs-field" title="${escapeHtml(copy.builder.mergeTag)}" style="max-width:9rem;font-size:0.75rem"><option value="">${escapeHtml(copy.builder.mergeTag)}</option>${options}</select>`
}

function addStoreBlocks(editor: Editor, brand: EmailBrand, copy: Copy) {
  const bm = editor.Blocks
  const category = copy.categories.store
  const footer = footerMjml(brand, copy.footer)
  bm.add('store-logo', {
    label: copy.blocks.logo,
    category,
    media: ICONS.logo,
    content: logoMjml(brand),
  })
  bm.add('store-product-card', {
    label: copy.blocks.productCard,
    category,
    media: ICONS.card,
    content: productGridMjml([SAMPLE], brand, {
      columns: 1,
      buttonLabel: copy.products.buttonLabel,
    }),
  })
  bm.add('store-product-grid', {
    label: copy.blocks.productGrid,
    category,
    media: ICONS.grid,
    content: productGridMjml([SAMPLE, SAMPLE], brand, {
      columns: 2,
      buttonLabel: copy.products.buttonLabel,
    }),
  })
  bm.add('store-discount', {
    label: copy.blocks.discount,
    category,
    media: ICONS.discount,
    content: discountMjml({ code: 'CODE10', heading: copy.discount.headingDefault }, brand),
  })
  const social = socialMjml(brand)
  bm.add('store-social', {
    label: copy.blocks.social,
    category,
    media: ICONS.social,
    content:
      social ||
      socialMjml({
        ...brand,
        social: [
          { platform: 'instagram', url: 'https://instagram.com/' },
          { platform: 'facebook', url: 'https://facebook.com/' },
        ],
      }),
  })
  bm.add('store-footer', {
    label: copy.blocks.footer,
    category,
    media: ICONS.footer,
    content: footer,
  })
}

/** The email's inner width (600px less the usual 24px padding each side), for shape heights. */
const CONTENT_WIDTH = 552

/** Height ÷ width for each shape; '' keeps the photo's own proportions. */
const SHAPES = ['', '1', '0.75', '0.5625', '1.25'] as const

/** The class the server turns into `object-fit: cover` (see `compileEmailDesign`). */
export const FIT_CLASS = 'k-fit'

const SOCIAL_NETWORKS = [
  'instagram',
  'facebook',
  'youtube',
  'x',
  'linkedin',
  'pinterest',
  'web',
] as const

/** A fixed shape is a fixed height for the image's width, cropped to fill (`object-fit`). */
function applyShape(component: Component) {
  const ratio = Number(component.get('k-shape') || 0)
  const attrs = component.getAttributes()
  if (!ratio) {
    const { height: _h, 'css-class': _c, ...rest } = attrs
    component.setAttributes(rest)
    return
  }
  const width = Number.parseInt(String(attrs.width ?? ''), 10) || CONTENT_WIDTH
  component.addAttributes({
    height: `${Math.round(width * ratio)}px`,
    'css-class': FIT_CLASS,
  })
}

/**
 * Plain-language settings on the pieces merchants change most (owner feedback, 3 Nov 2026):
 * an image's link, size, shape, corners and alignment; a button's link; each social icon's own
 * network and link. "Link to a product or collection" opens the store picker.
 */
function addFriendlyTraits(editor: Editor, copy: Copy, onPick: (r: PickRequest) => void) {
  const t = copy.traits
  editor.TraitManager.addType('store-link', {
    noLabel: true,
    createInput({ component }: { component: Component }) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'gjs-btn-prim'
      button.style.width = '100%'
      button.textContent = t.pickLink
      button.addEventListener('click', () => onPick({ kind: 'link', component }))
      return button
    },
  })

  const ensure = (component: Component, traits: Record<string, unknown>[]) => {
    const missing = traits.filter((tr) => !component.getTrait(String(tr.name)))
    if (missing.length) component.addTrait(missing as never)
  }

  editor.on('component:selected', (component: Component) => {
    const type = component.get('type')
    if (type === 'mj-image') {
      ensure(component, [
        { type: 'store-link', name: 'k-link' },
        {
          type: 'select',
          name: 'width',
          label: t.width,
          options: [
            { id: '', label: t.widthFull },
            ...['480px', '400px', '320px', '240px', '160px'].map((w) => ({ id: w, label: w })),
          ],
        },
        {
          type: 'select',
          name: 'k-shape',
          label: t.shape,
          changeProp: true,
          options: SHAPES.map((id, i) => ({ id, label: t.shapes[i] ?? id })),
        },
        {
          type: 'select',
          name: 'border-radius',
          label: t.corners,
          options: [
            { id: '0px', label: t.cornersNone },
            { id: '8px', label: t.cornersSmall },
            { id: '16px', label: t.cornersLarge },
          ],
        },
        {
          type: 'select',
          name: 'align',
          label: t.align,
          options: [
            { id: 'left', label: t.left },
            { id: 'center', label: t.center },
            { id: 'right', label: t.right },
          ],
        },
      ])
      if (!component.get('k-shape-wired')) {
        component.set('k-shape-wired', true)
        component.on('change:k-shape', () => applyShape(component))
        component.on(
          'change:attributes:width',
          () => component.get('k-shape') && applyShape(component),
        )
      }
    }
    if (type === 'mj-button') ensure(component, [{ type: 'store-link', name: 'k-link' }])
    if (type === 'mj-social-element') {
      // Our icons link straight to the profile ("-noshare"), which MJML's own list does not
      // show; offer those so each icon's network and link can be changed on its own.
      component.getTrait('name')?.set(
        'options',
        SOCIAL_NETWORKS.map((n) => ({ id: `${n}-noshare`, label: t.networks[n] })),
      )
    }
    if (type && ['mj-image', 'mj-button', 'mj-social-element'].includes(type)) {
      editor.Panels.getButton('views', 'open-tm')?.set('active', true)
    }
  })
}

/** A ready editor on `container`, showing the saved design or a brand starter. */
export function createEmailEditor(opts: EmailEditorOptions): Editor {
  const { brand, copy } = opts
  const editor = grapesjs.init({
    container: opts.container,
    height: '100%',
    width: 'auto',
    fromElement: false,
    storageManager: false,
    assetManager: { custom: true },
    plugins: [
      (e) =>
        mjmlPlugin(e, {
          blocks: [...MJML_BLOCKS],
          block: (id: string) => labelFor(id, copy) ?? {},
          fonts: {},
          imagePlaceholderSrc: '',
        }),
    ],
    ...(opts.design?.project
      ? { projectData: opts.design.project }
      : {
          components: opts.design?.mjml || starterMjml(brand, { ...copy.starter, ...copy.footer }),
        }),
  })

  addStoreBlocks(editor, brand, copy)
  addFriendlyTraits(editor, copy, opts.onPick)

  editor.RichTextEditor.add('merge-tag', {
    name: 'merge-tag',
    icon: mergeTagSelect(copy),
    event: 'change',
    result: (rte, action) => {
      const select = action.btn?.firstElementChild as HTMLSelectElement | null
      if (!select?.value) return
      rte.insertHTML(`{${select.value}}`)
      select.value = ''
    },
  })

  editor.on(
    'block:drag:stop',
    (component: Component | undefined, block: { getId: () => string }) => {
      if (!component) return
      const id = block.getId()
      if (id === 'store-product-card') opts.onPick({ kind: 'products', component, columns: 1 })
      if (id === 'store-product-grid') opts.onPick({ kind: 'products', component, columns: 2 })
      if (id === 'store-discount') opts.onPick({ kind: 'discount', component })
    },
  )

  editor.on('asset:custom', (data: AssetsCustomData) => {
    if (data.open) opts.onPickImage(data)
  })

  editor.on('load', () => {
    editor.Panels.getButton('views', 'open-blocks')?.set('active', true)
    editor.clearDirtyCount()
  })

  return editor
}

/** The design as stored: project JSON, its MJML and the browser-compiled HTML for the preview. */
export function readDesign(editor: Editor): EmailDesign | null {
  const mjml = String(editor.runCommand('mjml-code') ?? '')
  const out = editor.runCommand('mjml-code-to-html') as { html?: string } | undefined
  if (!out?.html) return null
  return { project: editor.getProjectData(), mjml, html: out.html }
}

/** Swaps a dropped placeholder for the real store block. */
export function replacePlaceholder(component: Component, mjml: string) {
  if (!mjml) {
    component.remove()
    return
  }
  component.replaceWith(mjml)
}

/** Loads a saved template onto the canvas, from its project data or, failing that, its MJML. */
export function loadDesign(editor: Editor, design: EmailDesign) {
  if (design.project) editor.loadProjectData(design.project)
  else editor.setComponents(design.mjml)
}
