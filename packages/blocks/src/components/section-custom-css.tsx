import { scopedCustomCss } from '../section-settings'

/**
 * A section's own CSS (Section settings → Advanced → Custom CSS), nested under the class its
 * frame carries. Cleaned by `cleanCustomCss`, so nothing in it can leave the style element.
 */
export default function SectionCustomCss({ css }: { css: string }) {
  const rule = scopedCustomCss(css)
  if (!rule) return null
  // biome-ignore lint/security/noDangerouslySetInnerHtml: cleanCustomCss strips anything that could close the style tag or open HTML
  return <style dangerouslySetInnerHTML={{ __html: rule }} />
}
