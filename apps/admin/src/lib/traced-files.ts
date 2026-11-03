/**
 * Files the admin reads by path at run time, relative to apps/admin. Next's standalone tracing
 * only follows imports, so `next.config.ts` lists these in `outputFileTracingIncludes`; a file
 * missing here is missing from the Docker image.
 *
 * - The India Post PIN code directory (`@commerce/shipping/pincode-directory`): City/State autofill.
 * - The invoice fonts (`@commerce/invoices/render` `fontsDir`): served by
 *   `/api/apps/gst-invoices/fonts` to the GST settings live preview.
 */
export const TRACED_RUNTIME_FILES = [
  '../../packages/shipping/data/pincode-directory.json.gz',
  '../../packages/invoices/fonts/**/*.ttf',
] as const
