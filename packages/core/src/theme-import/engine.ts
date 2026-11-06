/** SOURCE OF TRUTH: the Liquid engine for imported themes — WHAT: one LiquidJS instance per imported theme, its snippets served from memory, the Shopify-only tags (form, style, stylesheet, javascript, doc, schema, content_for, paginate, section, sections, layout) and the render limits / WHY: a theme's Liquid is untrusted merchant code; it runs here with no file system, no network and capped time and memory, and every form it draws posts to our own handlers instead of Shopify's */
import {
  Context,
  type Emitter,
  evalToken,
  Hash,
  Liquid,
  type Parser,
  Tag,
  type TagToken,
  type Template,
  Tokenizer,
  type TopLevelToken,
  TypeGuards,
  toValueSync,
  Value,
  type ValueToken,
} from 'liquidjs'
import { CommerceError } from '../errors'
import { AssignTag } from './assign-tag'
import { escapeAttr, type LiquidRuntime, registerShopifyFilters, stringifyLiquid } from './filters'
import { MAX_BLOCK_DEPTH } from './schema'

/** Where the forms a theme draws post to: our handlers, never Shopify's endpoints. */
const THEME_ACTIONS = {
  cartAdd: '/theme-actions/cart-add',
  newsletter: '/theme-actions/newsletter',
  contact: '/theme-actions/contact',
  localization: '/theme-actions/localization',
} as const

/** Runtime extras the structural tags call back into (static sections, groups, theme blocks). */
export type LiquidHooks = {
  /** `{% section 'cart-drawer' %}`: a static section, rendered with its saved or default settings. */
  renderStaticSection?: ((type: string) => string) | undefined
  /** `{% sections 'header-group' %}`: the layout leaves a marker the storefront fills. */
  renderGroup?: ((name: string) => string) | undefined
  /** `{% content_for 'blocks' %}` and `{% content_for 'block' %}`: theme blocks. */
  renderThemeBlock?:
    | ((
        block: unknown,
        section: unknown,
        ctx: Context,
        depth: number,
        extras: Record<string, unknown>,
      ) => string)
    | undefined
  /** `?form_posted=<type>` on the request, so `form.posted_successfully?` is true after a post. */
  postedForm?: string | null | undefined
  /** False when the Forms app is not installed: `{% form 'contact' %}` shows a plain notice instead. */
  formsAvailable?: boolean | undefined
}

/** What a contact form shows when the Forms app is not installed for the store. */
const FORM_UNAVAILABLE =
  '<p class="form-unavailable" role="status">This form is not available right now.</p>'

export type EngineRuntime = LiquidRuntime & LiquidHooks

const runtime = (ctx: Context): EngineRuntime => {
  const rt = (ctx.globals as { _rt?: EngineRuntime })._rt
  if (!rt) throw new Error('Liquid render without a runtime')
  return rt
}

/** Collects the tokens up to `end`, parsed, for block tags. */
function parseBody(
  tagToken: TagToken,
  remainTokens: TopLevelToken[],
  parser: Parser,
  end: string,
): Template[] {
  const templates: Template[] = []
  while (remainTokens.length) {
    const token = remainTokens.shift() as TopLevelToken
    if (TypeGuards.isTagToken(token) && token.name === end) return templates
    templates.push(parser.parseToken(token, remainTokens))
  }
  throw new Error(`tag ${tagToken.getText()} not closed`)
}

/** Skips everything up to `end` without parsing it (docs, schema). */
function skipBody(tagToken: TagToken, remainTokens: TopLevelToken[], end: string): void {
  while (remainTokens.length) {
    const token = remainTokens.shift() as TopLevelToken
    if (TypeGuards.isTagToken(token) && token.name === end) return
  }
  throw new Error(`tag ${tagToken.getText()} not closed`)
}

class SkipTag extends Tag {
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
    super(token, remain, liquid)
    skipBody(token, remain, `end${token.name}`)
  }
  *render(): Generator<unknown, void, unknown> {}
}

/** Wraps its rendered body in an element: `{% style %}` → `<style data-shopify>`. */
function wrapTag(open: string, close: string) {
  return class extends Tag {
    templates: Template[]
    constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid, parser: Parser) {
      super(token, remain, liquid)
      this.templates = parseBody(token, remain, parser, `end${token.name}`)
    }
    *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
      const html = (yield this.liquid.renderer.renderTemplates(this.templates, ctx)) as string
      const tag = open.includes('<script')
        ? open.replace('<script', `<script${nonceAttr(runtime(ctx).nonce)}`)
        : open
      emitter.write(`${tag}${html}${close}`)
    }
  }
}

const nonceAttr = (nonce: string) => (nonce ? ` nonce="${escapeAttr(nonce)}"` : '')

/** Reads `'type', object, key: value...` tag arguments. */
function readFormArgs(tk: Tokenizer): { type?: ValueToken; object?: ValueToken; hash: Hash } {
  const type = tk.readValue()
  tk.skipBlank()
  if (tk.peek() === ',') tk.advance()
  tk.skipBlank()
  const save = tk.p
  const ident = tk.readIdentifier()
  tk.skipBlank()
  let object: ValueToken | undefined
  if (!(ident.content && tk.peek() === ':')) {
    tk.p = save
    object = tk.readValue()
  } else tk.p = save
  return { ...(type ? { type } : {}), ...(object ? { object } : {}), hash: new Hash(tk) }
}

const FORM_ACTION: Record<string, { action: string; method?: string }> = {
  product: { action: THEME_ACTIONS.cartAdd },
  customer: { action: THEME_ACTIONS.newsletter },
  contact: { action: THEME_ACTIONS.contact },
  localization: { action: THEME_ACTIONS.localization },
  currency: { action: THEME_ACTIONS.localization },
  cart: { action: '/cart' },
  customer_login: { action: '/account/login', method: 'get' },
  create_customer: { action: '/account/login', method: 'get' },
  guest_login: { action: '/account/login', method: 'get' },
  recover_customer_password: { action: '/account/login', method: 'get' },
  reset_customer_password: { action: '/account/login', method: 'get' },
  activate_customer_password: { action: '/account/login', method: 'get' },
  customer_address: { action: '/account/addresses', method: 'get' },
  storefront_password: { action: '/', method: 'get' },
  new_comment: { action: '#', method: 'get' },
}

/** Attributes the form tag accepts that are not HTML attributes. */
const FORM_OWN = new Set(['return_to'])

/**
 * `{% form 'product', product %}`: the theme's look, posting to our handlers. The
 * inner `form` object reads like Shopify's (`form.id`, `form.errors`,
 * `form.posted_successfully?`).
 */
class FormTag extends Tag {
  templates: Template[]
  args: ReturnType<typeof readFormArgs>
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid, parser: Parser) {
    super(token, remain, liquid)
    this.args = readFormArgs(this.tokenizer)
    this.templates = parseBody(token, remain, parser, 'endform')
  }
  *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const type = this.args.type ? stringifyLiquid(yield evalToken(this.args.type, ctx)) : ''
    const object = this.args.object ? yield evalToken(this.args.object, ctx) : null
    const hash = (yield this.args.hash.render(ctx)) as Record<string, unknown>
    const target = FORM_ACTION[type] ?? { action: '#', method: 'get' }
    if (type === 'contact' && runtime(ctx).formsAvailable === false) {
      emitter.write(FORM_UNAVAILABLE)
      return
    }
    const attrs: Record<string, unknown> = {
      method: target.method ?? 'post',
      action: target.action,
      'accept-charset': 'UTF-8',
    }
    for (const [k, v] of Object.entries(hash)) {
      if (FORM_OWN.has(k) || v === undefined || v === null || v === false) continue
      attrs[k] = v
    }
    if (type === 'product') attrs.enctype = 'multipart/form-data'
    const posted = runtime(ctx).postedForm === type
    // A post we rejected comes back as `?form_posted=<type>_error`: the form shows its errors.
    const failed = runtime(ctx).postedForm === `${type}_error`
    const formObject = {
      id: hash.id ?? `${type}_form`,
      errors: failed ? ['form'] : null,
      email: '',
      body: '',
      name: '',
      'posted_successfully?': posted,
      posted_successfully: posted,
      set_as_default_checkbox: '',
    }
    const hidden = [
      `<input type="hidden" name="form_type" value="${escapeAttr(type)}" />`,
      '<input type="hidden" name="utf8" value="✓" />',
    ]
    if (type === 'product' && object && typeof object === 'object' && 'id' in object) {
      hidden.push(
        `<input type="hidden" name="product-id" value="${escapeAttr((object as { id: unknown }).id)}" />`,
      )
    }
    if (typeof hash.return_to === 'string') {
      hidden.push(`<input type="hidden" name="return_to" value="${escapeAttr(hash.return_to)}" />`)
    }
    // Spam trap for the contact form: a field a person never sees, so only a script fills it.
    if (type === 'contact') {
      hidden.push(
        '<div hidden aria-hidden="true"><input type="text" name="contact_website" tabindex="-1" autocomplete="off" value="" /></div>',
      )
    }
    ctx.push({ form: formObject })
    const inner = (yield this.liquid.renderer.renderTemplates(this.templates, ctx)) as string
    ctx.pop()
    const attrText = Object.entries(attrs)
      .map(([k, v]) => (v === true ? k : `${k}="${escapeAttr(stringifyLiquid(v))}"`))
      .join(' ')
    emitter.write(`<form ${attrText}>${hidden.join('')}${inner}</form>`)
  }
}

/** `{% paginate list by 12 %}`: one page (we hand themes up to 50 items), with `paginate`. */
class PaginateTag extends Tag {
  templates: Template[]
  list: Value
  size: number
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid, parser: Parser) {
    super(token, remain, liquid)
    const m = /^(.*?)\s+by\s+(\S+)/.exec(token.args.trim())
    this.list = new Value(m?.[1] ?? token.args, liquid)
    this.size = Number(m?.[2]) || 12
    this.templates = parseBody(token, remain, parser, 'endpaginate')
  }
  *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const value = yield this.list.value(ctx, false)
    const items = Array.isArray(value) ? value.length : 0
    const pages = Math.max(1, Math.ceil(items / this.size))
    ctx.push({
      paginate: {
        current_page: 1,
        current_offset: 0,
        items,
        page_size: this.size,
        pages,
        parts: [],
        next: pages > 1 ? { title: 'Next', url: '?page=2', is_link: true } : null,
        previous: null,
        page_param: 'page',
      },
    })
    const inner = (yield this.liquid.renderer.renderTemplates(this.templates, ctx)) as string
    ctx.pop()
    emitter.write(inner)
  }
}

/** `{% section 'cart-drawer' %}`. */
class SectionTag extends Tag {
  nameToken: ValueToken | undefined
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
    super(token, remain, liquid)
    this.nameToken = this.tokenizer.readValue()
  }
  *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const name = this.nameToken ? stringifyLiquid(yield evalToken(this.nameToken, ctx)) : ''
    const render = runtime(ctx).renderStaticSection
    if (name && render) emitter.write(render(name))
  }
}

/** `{% sections 'header-group' %}`. */
class SectionsTag extends Tag {
  nameToken: ValueToken | undefined
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
    super(token, remain, liquid)
    this.nameToken = this.tokenizer.readValue()
  }
  *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const name = this.nameToken ? stringifyLiquid(yield evalToken(this.nameToken, ctx)) : ''
    const render = runtime(ctx).renderGroup
    if (name && render) emitter.write(render(name))
  }
}

/**
 * Scope keys a theme block's render carries: the block itself (whose `content_for 'blocks'`
 * lists its own children) and how deep it sits.
 */
export const BLOCK_SCOPE = {
  parent: 'commerce_parent_block',
  depth: 'commerce_block_depth',
} as const

type BlockOwner =
  | { blocks?: { id?: string; type?: string; static?: boolean; disabled?: boolean }[] }
  | null
  | undefined

/** The resources `closest.x` reaches when no parent set one: the page's own. */
const CLOSEST_RESOURCES = ['product', 'collection', 'article', 'blog', 'page'] as const

/** LiquidJS hash keys stop at a dot, so `closest.product: x` is read under this key instead. */
const CLOSEST_KEY = 'closest__'
const CLOSEST_ARG = /\bclosest\.(\w+)\s*:/g

/**
 * `{% content_for 'blocks' %}` (the section's theme blocks) and
 * `{% content_for 'block', type: 'x', id: 'y' %}` (one static block). Other arguments
 * (`variant: 'mobile'`) are variables in the block, and `closest.product: p` is what the
 * block and everything inside it read as `closest.product`.
 */
class ContentForTag extends Tag {
  kind: ValueToken | undefined
  hash: Hash
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
    super(token, remain, liquid)
    this.tokenizer = new Tokenizer(
      token.args.replace(CLOSEST_ARG, `${CLOSEST_KEY}$1:`),
      liquid.options.operators,
    )
    this.kind = this.tokenizer.readValue()
    this.hash = new Hash(this.tokenizer)
  }
  /** The variables a block gets from this tag, `closest` carried down from its parent. */
  *extras(
    ctx: Context,
    args: Record<string, unknown>,
  ): Generator<unknown, Record<string, unknown>, unknown> {
    const closest: Record<string, unknown> = {}
    const parent = (yield ctx._get(['closest'])) as Record<string, unknown> | undefined
    if (parent) Object.assign(closest, parent)
    else for (const key of CLOSEST_RESOURCES) closest[key] = yield ctx._get([key])
    const extras: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(args)) {
      if (key.startsWith(CLOSEST_KEY)) closest[key.slice(CLOSEST_KEY.length)] = value
      else if (key !== 'type' && key !== 'id') extras[key] = value
    }
    return { ...extras, closest }
  }
  *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const kind = this.kind ? stringifyLiquid(yield evalToken(this.kind, ctx)) : ''
    const render = runtime(ctx).renderThemeBlock
    if (!render) return
    const section = yield ctx._get(['section'])
    // INVARIANT: inside a theme block the children are that block's own (a tab's contents),
    // never the section's: the section's list holds the block itself and would loop forever.
    const parent = (yield ctx._get([BLOCK_SCOPE.parent])) as BlockOwner
    const depth = Number(yield ctx._get([BLOCK_SCOPE.depth])) || 0
    if (depth >= MAX_BLOCK_DEPTH) return
    const blocks = ((parent ?? section) as BlockOwner)?.blocks ?? []
    const hash = (yield this.hash.render(ctx)) as Record<string, unknown>
    const extras = (yield* this.extras(ctx, hash)) as Record<string, unknown>
    if (kind === 'blocks') {
      // Static blocks are placed by the theme's code, never listed with the merchant's.
      for (const block of blocks) {
        if (!block.static) emitter.write(render(block, section, ctx, depth + 1, extras))
      }
      return
    }
    if (kind === 'block') {
      const id = stringifyLiquid(hash.id)
      const placed = blocks.find((b) => b.id === id)
      // A static block the merchant turned off shows nothing (Claw Gears hides its header menu).
      if (placed?.disabled) return
      const found = placed ?? {
        id,
        type: stringifyLiquid(hash.type),
        settings: {},
        shopify_attributes: '',
        unplaced: true,
      }
      emitter.write(render(found, section, ctx, depth + 1, extras))
    }
  }
}

/** `{% layout none %}` and friends: the storefront owns the page shell. */
class NoopTag extends Tag {
  *render(): Generator<unknown, void, unknown> {}
}

/**
 * The tag `bundle.ts` writes after every `<script` in a theme's source: the request's CSP
 * nonce as an attribute (nothing in the editor, where there is none). Only source can hold
 * a tag, so data a theme prints never gets a nonce.
 */
export const SCRIPT_NONCE_TAG = 'commerce_script_nonce'

class ScriptNonceTag extends Tag {
  render(ctx: Context, emitter: Emitter): void {
    emitter.write(nonceAttr(runtime(ctx).nonce))
  }
}

/**
 * Render limits for untrusted theme code: a runaway loop stops instead of holding a request.
 * Renders are synchronous (see `cache.ts`), so while one runs the whole server waits: every
 * store on it, not just this one. The limits are CPU time, database reads are not in them
 * (they happen between passes).
 */
export const LIQUID_LIMITS = {
  /** Milliseconds one render pass may take. A real section takes a few. */
  renderMs: 2_000,
  /**
   * Milliseconds all the renders of one page context may take together (layout, every
   * section, every pass): one request can never hold the server longer than this.
   */
  pageMs: 6_000,
  /** Characters one render may write; a section bigger than this is a loop, not a page. */
  outputChars: 4_000_000,
  /** Characters one template may have. */
  parseChars: 1_000_000,
  /** Rough memory units LiquidJS may allocate in one render. */
  memory: 50_000_000,
} as const

/** A render that ran out of its time or output budget. */
class LiquidBudgetError extends CommerceError {
  constructor(message: string) {
    super('LIQUID_BUDGET', message)
  }
}

/** The output of one render, refused once it passes `max` characters. */
class CappedEmitter implements Emitter {
  buffer = ''
  readonly #max: number
  constructor(max: number) {
    this.#max = max
  }
  write(html: unknown): void {
    this.buffer += stringifyLiquid(html)
    if (this.buffer.length > this.#max) {
      throw new LiquidBudgetError('a theme render wrote more than its output limit')
    }
  }
}

/** Time spent rendering for one page context, shared by every render it makes. */
export type RenderBudget = { spentMs: number; since: number | null }

export const newRenderBudget = (): RenderBudget => ({ spentMs: 0, since: null })

/**
 * `engine.renderSync`, held to the page's budget: at most `renderMs` for this pass and
 * never past `pageMs` for the page, with the output capped. Nested renders (a static
 * section or theme block inside a section) count once, inside their outer render.
 */
export function renderBounded(
  engine: Liquid,
  budget: RenderBudget,
  tpl: Template[],
  scope: object,
  globals: object,
): string {
  const now = performance.now()
  const nested = budget.since !== null
  const used = budget.spentMs + (nested ? now - (budget.since as number) : 0)
  const left = LIQUID_LIMITS.pageMs - used
  if (left <= 0) throw new LiquidBudgetError('this page used up its theme render time')
  if (!nested) budget.since = now
  try {
    const ctx = new Context(
      scope,
      engine.options,
      { globals, sync: true, renderLimit: Math.min(LIQUID_LIMITS.renderMs, left) },
      { liquid: engine },
    )
    const emitter = new CappedEmitter(LIQUID_LIMITS.outputChars)
    return toValueSync(
      engine.renderer.renderTemplates(tpl, ctx, emitter) as Generator<unknown, string, unknown>,
    )
  } finally {
    if (!nested) {
      budget.spentMs += performance.now() - now
      budget.since = null
    }
  }
}

/**
 * A Liquid engine for one theme. `snippets` maps a snippet name (`icon-cart`) to its
 * source; `render` and `include` read only from it, never from disk.
 */
export function createThemeEngine(snippets: Map<string, string>): Liquid {
  const templates: Record<string, string> = {}
  for (const [name, source] of snippets) templates[`${name}.liquid`] = source
  const engine = new Liquid({
    templates,
    extname: '.liquid',
    cache: true,
    strictFilters: false,
    strictVariables: false,
    ownPropertyOnly: true,
    jsTruthy: false,
    dynamicPartials: true,
    parseLimit: LIQUID_LIMITS.parseChars,
    renderLimit: LIQUID_LIMITS.renderMs,
    memoryLimit: LIQUID_LIMITS.memory,
  })
  registerShopifyFilters(engine)
  engine.registerTag('assign', AssignTag)
  engine.registerTag('form', FormTag)
  engine.registerTag('paginate', PaginateTag)
  engine.registerTag('section', SectionTag)
  engine.registerTag('sections', SectionsTag)
  engine.registerTag('content_for', ContentForTag)
  engine.registerTag('schema', SkipTag)
  engine.registerTag('doc', SkipTag)
  engine.registerTag('layout', NoopTag)
  engine.registerTag(SCRIPT_NONCE_TAG, ScriptNonceTag)
  engine.registerTag('style', wrapTag('<style data-shopify>', '</style>'))
  engine.registerTag('stylesheet', wrapTag('<style>', '</style>'))
  engine.registerTag('javascript', wrapTag('<script>', '</script>'))
  return engine
}
