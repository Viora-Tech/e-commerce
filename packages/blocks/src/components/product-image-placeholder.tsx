/**
 * What a product without a photo shows, on cards and the product page: a quiet bag outline on a
 * faint surface, so a new store's products read as products instead of empty boxes.
 */
export default function ProductImagePlaceholder() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="product-image-placeholder">
      <path
        d="M10 16h28l-2.2 22.4A3 3 0 0 1 32.8 41H15.2a3 3 0 0 1-3-2.6L10 16Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M18 20v-6a6 6 0 0 1 12 0v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
