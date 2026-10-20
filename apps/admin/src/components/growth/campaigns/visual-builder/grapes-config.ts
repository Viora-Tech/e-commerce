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
