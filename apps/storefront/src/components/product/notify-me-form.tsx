'use client'

import type { NotifyMeFormProps } from '@commerce/blocks'
import NotifyMeFields from './notify-me-fields'
import NotifyMePopup from './notify-me-popup'

/** "{product}" in the campaign's pop-up line, as Essential fills it ("Product - Variant"). */
function describe(template: string, productTitle?: string, variantTitle?: string): string {
  const own =
    variantTitle && variantTitle !== 'Default' && variantTitle !== 'Default Title'
      ? variantTitle
      : null
  const name = [productTitle, own].filter(Boolean).join(' - ')
  return name ? template.replaceAll('{product}', name) : template.replaceAll('{product}', '')
}

/**
 * Sold-out variant, not on pre-order: the Back in stock app's signup. With the campaign's
 * "Pop up" display (the default) a Notify me button opens the form in a pop-up, as Essential's
 * app does; "Inline" draws the form in the buy box's sold-out panel (`product-notify`).
 */
export default function NotifyMeForm({
  variantId,
  whatsappEnabled,
  buttonText,
  widget,
  productTitle,
  variantTitle,
}: NotifyMeFormProps) {
  // Render logic
  const popup = widget && widget.display === 'popup'

  return popup ? (
    <NotifyMePopup
      variantId={variantId}
      whatsappEnabled={whatsappEnabled}
      widget={widget}
      description={describe(widget.popupDescription, productTitle, variantTitle)}
    />
  ) : (
    <NotifyMeFields
      variantId={variantId}
      whatsappEnabled={whatsappEnabled}
      widget={widget ?? null}
      buttonText={buttonText}
    />
  )
}
