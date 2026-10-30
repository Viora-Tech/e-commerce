type ReviewsWidgetHintProps = { text: string }

/** What a Reviews section says in the theme editor when it has nothing to draw yet. */
export default function ReviewsWidgetHint({ text }: ReviewsWidgetHintProps) {
  return (
    <div className="page-width">
      <p className="m-0 rounded-[var(--radius-m)] border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
        {text}
      </p>
    </div>
  )
}
