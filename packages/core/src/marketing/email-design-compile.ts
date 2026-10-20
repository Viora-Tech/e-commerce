/** SOURCE OF TRUTH: compileEmailDesign — WHAT: MJML to sanitised email HTML with the compiler's errors / WHY: one server-side compile step for saving, previewing and sending a design */
import mjml2html from 'mjml'
import { MAX_DESIGN_MJML, sanitizeEmailHtml } from './email-design'

export type CompiledDesign = { html: string; errors: string[] }

/**
 * MJML → email HTML for the visual builder, on the server at every save so the sender only
 * ever reads stored HTML. Includes are off (a design must never read a file from this host),
 * and the output is sanitised. Server only: `@commerce/core/email-design-compile`.
 */
export async function compileEmailDesign(mjml: string): Promise<CompiledDesign> {
  if (!mjml.trim()) return { html: '', errors: [] }
  if (mjml.length > MAX_DESIGN_MJML) return { html: '', errors: ['design is too large'] }
  try {
    const out = await mjml2html(mjml, {
      validationLevel: 'soft',
      keepComments: false,
      ignoreIncludes: true,
      fonts: {},
    })
    return {
      html: sanitizeEmailHtml(out.html),
      errors: out.errors.map((e) => e.formattedMessage ?? e.message),
    }
  } catch (err) {
    return { html: '', errors: [err instanceof Error ? err.message : String(err)] }
  }
}
