import { THEME_PREVIEW_PARAM } from '@commerce/core/theme'
import { previewBarContent as copy } from '@/data/online-store'

type PreviewBarProps = {
  themeName: string
}

/** Pinned bar while a merchant previews an unpublished theme in a normal tab. */
export default function PreviewBar({ themeName }: PreviewBarProps) {
  // Render logic
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-ink px-4 py-2 text-center text-sm text-bg"
    >
      <span className="font-semibold">{copy.label(themeName)}</span>
      <span className="opacity-80">{copy.hint}</span>
      <a href={`/?${THEME_PREVIEW_PARAM}=exit`} className="underline underline-offset-4">
        {copy.exit}
      </a>
    </div>
  )
}
