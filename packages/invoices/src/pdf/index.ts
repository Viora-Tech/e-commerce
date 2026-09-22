/** Browser-safe PDF entry: fonts plus rendering to a Blob for the live preview. */
import { pdf } from '@react-pdf/renderer'
import { documentElement, type TemplateProps } from '../templates'

export { FONT_FILES, fontStack, registerFonts } from './fonts'

export async function renderDocumentToBlob(props: TemplateProps): Promise<Blob> {
  return pdf(documentElement(props)).toBlob()
}
