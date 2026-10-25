/** SOURCE OF TRUTH: Edit code's file names — WHAT: how a native theme's templates and settings appear as files (`templates/index.json`, `config/theme-settings.json`), and which new files a theme may get / WHY: the browser and the server must agree on every path, and Shopify merchants expect Shopify's names */
import {
  ALTERNATE_KINDS,
  type AlternateKind,
  SECTION_GROUPS,
  TEMPLATE_KINDS,
  TEMPLATE_SUFFIX,
  type TemplateKey,
} from '../theme/templates-data'

/** A native theme's settings document, as Edit code shows it. */
export const NATIVE_SETTINGS_PATH = 'config/theme-settings.json'

/** Our template keys under their Shopify file names (home is `index`, not found is `404`). */
const FILE_NAMES: Partial<Record<TemplateKey, string>> = { home: 'index', not_found: '404' }

/** `templates/product.preorder.json`, `sections/header-group.json`. */
export function nativeTemplatePath(template: TemplateKey, suffix: string): string {
  if ((SECTION_GROUPS as readonly string[]).includes(template)) {
    return `sections/${template}-group.json`
  }
  const name = FILE_NAMES[template] ?? template
  return `templates/${name}${suffix ? `.${suffix}` : ''}.json`
}

/** The template a native path names, or null when it names none. */
export function parseNativeTemplatePath(
  path: string,
): { template: TemplateKey; suffix: string } | null {
  const group = /^sections\/(header|footer)-group\.json$/.exec(path)
  if (group?.[1]) return { template: group[1] as TemplateKey, suffix: '' }
  const m = /^templates\/([a-z0-9_]+)(?:\.([a-z0-9-]+))?\.json$/.exec(path)
  if (!m?.[1]) return null
  const byFile = Object.entries(FILE_NAMES).find(([, file]) => file === m[1])?.[0]
  const template = (byFile ?? m[1]) as TemplateKey
  if (!(TEMPLATE_KINDS as readonly string[]).includes(template)) return null
  const suffix = m[2] ?? ''
  if (!TEMPLATE_SUFFIX.test(suffix)) return null
  return { template, suffix }
}

/** What "Add a new file" can make, the folder it goes in and its extension. */
export const NEW_FILE_KINDS = {
  section: { folder: 'sections', ext: '.liquid' },
  snippet: { folder: 'snippets', ext: '.liquid' },
  block: { folder: 'blocks', ext: '.liquid' },
  template: { folder: 'templates', ext: '.json' },
  stylesheet: { folder: 'assets', ext: '.css' },
  script: { folder: 'assets', ext: '.js' },
  layout: { folder: 'layout', ext: '.liquid' },
  locale: { folder: 'locales', ext: '.json' },
} as const

export type NewFileKind = keyof typeof NEW_FILE_KINDS

/** Kinds each theme offers: a native theme's code lives in our library, so it gets templates. */
export const NEW_FILE_KINDS_FOR = {
  imported: [
    'section',
    'snippet',
    'block',
    'template',
    'stylesheet',
    'script',
    'layout',
    'locale',
  ] as NewFileKind[],
  native: ['template'] as NewFileKind[],
} as const

/** Lowercase letters, numbers and hyphens (and dots for a template's `product.preorder`). */
export const NEW_FILE_NAME = /^[a-z0-9][a-z0-9-]{0,59}$/

/** For a native template: `product.preorder` names an alternate of an alternate kind. */
export function parseAlternateName(
  name: string,
): { template: AlternateKind; suffix: string } | null {
  const [kind, suffix, extra] = name.split('.')
  if (extra !== undefined || !kind || !suffix) return null
  if (!(ALTERNATE_KINDS as readonly string[]).includes(kind)) return null
  if (!TEMPLATE_SUFFIX.test(suffix)) return null
  return { template: kind as AlternateKind, suffix }
}

/** What a new file starts with: a section gets a schema so it shows in Add section. */
export function newFileBody(kind: NewFileKind, name: string): string {
  const title = name.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  switch (kind) {
    case 'section':
      return `<section class="${name} page-width">\n  <h2>{{ section.settings.heading | escape }}</h2>\n</section>\n\n{% schema %}\n{\n  "name": "${title}",\n  "settings": [\n    { "type": "text", "id": "heading", "label": "Heading", "default": "${title}" }\n  ],\n  "presets": [{ "name": "${title}" }]\n}\n{% endschema %}\n`
    case 'block':
      return `<div {{ block.shopify_attributes }}>\n  {{ block.settings.text }}\n</div>\n\n{% schema %}\n{\n  "name": "${title}",\n  "settings": [{ "type": "text", "id": "text", "label": "Text" }]\n}\n{% endschema %}\n`
    case 'template':
      return '{\n  "sections": {},\n  "order": []\n}\n'
    case 'locale':
      return '{}\n'
    case 'stylesheet':
      return `/* ${title} */\n`
    case 'script':
      return `// ${title}\n`
    default:
      return ''
  }
}
