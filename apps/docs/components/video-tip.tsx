import { PlayCircle } from '@phosphor-icons/react/ssr'
import { videoTipCopy } from '../data/guides'

type VideoTipProps = {
  title: string
  caption: string
}

/**
 * Slot for a future 30-second how-to video, same idea as `<Screenshot>`: a framed
 * placeholder saying what the clip will show. Swap for a real `<video>` once recorded.
 */
export default function VideoTip({ title, caption }: VideoTipProps) {
  return (
    <span
      data-pagefind-ignore="all"
      className="mt-5 flex items-center gap-4 rounded-xl border border-dashed border-(--docs-border-strong) bg-(--docs-surface) px-5 py-4"
    >
      <span className="docs-home-card-icon inline-flex size-10 shrink-0 items-center justify-center rounded-full">
        <PlayCircle size={22} weight="light" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-medium tracking-wide text-(--docs-subtle) uppercase">
          {videoTipCopy.label} · {videoTipCopy.placeholder}
        </span>
        <span className="text-[0.9375rem] font-medium text-(--docs-fg)">{title}</span>
        <span className="text-sm text-(--docs-muted)">{caption}</span>
      </span>
    </span>
  )
}
