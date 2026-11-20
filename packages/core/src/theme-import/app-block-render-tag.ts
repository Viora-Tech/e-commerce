/** SOURCE OF TRUTH: `{% render block %}` for app blocks — WHAT: LiquidJS's `render` tag, except that rendering an app block object (Shopify's `{% when '@app' %}{% render block %}`) prints our widget's slot or the editor placeholder (`app-blocks.ts`) / WHY: LiquidJS would look for a snippet named after the object and fail the section; every other `render` is the stock tag */
import { type Context, type Emitter, evalToken, RenderTag, Token } from 'liquidjs'
import { isLiquidAppBlock } from './app-blocks'
import type { LiquidHooks } from './engine'

export class AppBlockRenderTag extends RenderTag {
  override *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    // An unquoted name (`render block`) is an expression; a quoted snippet name never is.
    const file = (this as unknown as { file: unknown }).file
    if (file instanceof Token) {
      const value = yield evalToken(file, ctx)
      if (isLiquidAppBlock(value)) {
        const hooks = (ctx.globals as { _rt?: LiquidHooks })._rt
        emitter.write(hooks?.renderAppBlock?.(value) ?? '')
        return
      }
    }
    yield* super.render(ctx, emitter)
  }
}
