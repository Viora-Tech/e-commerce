// The theme's `request.design_mode` hint (`.spec-table__hint`): what a product section says in the editor when it has nothing to show yet.
type ProductSectionHintProps = { text: string }

export default function ProductSectionHint({ text }: ProductSectionHintProps) {
  return <p className="spec-table__hint">{text}</p>
}
