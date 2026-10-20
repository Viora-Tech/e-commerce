/** SOURCE OF TRUTH: Shopify's `{% assign %}` for imported themes — WHAT: assign as LiquidJS does it, except that `blank` and `empty` store the empty string / WHY: Shopify's literals are '' as values; LiquidJS keeps an object that never equals `blank`, which emptied theme code that resets a list with `assign x = blank` */
import { type Context, Liquid, Tag, type TagToken, type TopLevelToken, Value } from 'liquidjs'

/**
 * LiquidJS's `blank` and `empty` literals: one shared object each, so a value can be told
 * apart from them by identity (their classes are not exported).
 */
const EMPTY_LITERALS: ReadonlySet<unknown> = new Set([
  new Liquid().evalValueSync('blank'),
  new Liquid().evalValueSync('empty'),
])

/**
 * `{% assign x = blank %}` as Shopify runs it: `blank` and `empty` are the empty string as
 * values. LiquidJS stores its literal object instead, and that object never equals `blank`,
 * so `if x == blank` turned false and `x.size` printed nothing (Zero Drift's add-ons row
 * resets its list with `assign items = blank`, then tests `items == blank`).
 */
export class AssignTag extends Tag {
  readonly key: string
  readonly value: Value
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
    super(token, remain, liquid)
    const identifier = this.tokenizer.readIdentifier()
    this.key = identifier.content
    this.tokenizer.assert(this.key, 'expected variable name')
    this.tokenizer.skipBlank()
    this.tokenizer.assert(this.tokenizer.peek() === '=', 'expected "="')
    this.tokenizer.advance()
    this.value = new Value(this.tokenizer.readFilteredValue(), liquid)
  }
  *render(ctx: Context): Generator<unknown, void, unknown> {
    const value = yield this.value.value(ctx, this.liquid.options.lenientIf)
    ctx.bottom()[this.key] = EMPTY_LITERALS.has(value) ? '' : value
  }
}
