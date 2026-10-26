import { chatTrackContent, chatTrackSteps } from '@/data/chat-track'
import type { ChatTrackStep, ChatTrackStepKey } from '@/lib/chat-track'

type ChatOrderTimelineProps = {
  steps: ChatTrackStep[]
  /** A second line under a step ("Delhivery · AWB 1234"); missing keys have none. */
  details: Partial<Record<ChatTrackStepKey, string>>
}

const DOT: Record<ChatTrackStep['state'], string> = {
  done: 'bg-[var(--color-success,currentColor)]',
  current:
    'bg-[var(--color-success,currentColor)] ring-[0.1875rem] ring-[color-mix(in_srgb,var(--color-success,currentColor)_22%,transparent)]',
  todo: 'border-[0.125rem] border-[color-mix(in_srgb,currentColor_28%,transparent)] bg-transparent',
}

const LABEL: Record<ChatTrackStep['state'], string> = {
  done: '',
  current: 'font-semibold',
  todo: 'opacity-55',
}

/** The order's five steps, top to bottom: green once reached, the latest one bold. */
export default function ChatOrderTimeline({ steps, details }: ChatOrderTimelineProps) {
  // Render logic
  return (
    <ol aria-label={chatTrackContent.card.timeline} className="flex flex-col">
      {steps.map((s, i) => {
        const next = steps[i + 1]
        const detail = details[s.key]
        return (
          <li
            key={s.key}
            aria-current={s.state === 'current' ? 'step' : undefined}
            className="relative flex gap-3 pb-3.5 last:pb-0"
          >
            <span aria-hidden="true" className="relative flex w-3 shrink-0 justify-center">
              <span className={`mt-[0.3125rem] size-2.5 rounded-full ${DOT[s.state]}`} />
              {next ? (
                <span
                  className={`absolute top-[1.125rem] bottom-[-0.125rem] w-[0.125rem] rounded-full ${
                    next.state === 'todo'
                      ? 'bg-[color-mix(in_srgb,currentColor_14%,transparent)]'
                      : 'bg-[var(--color-success,currentColor)]'
                  }`}
                />
              ) : null}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={`text-[0.875rem] leading-snug ${LABEL[s.state]}`}>
                {chatTrackSteps[s.key]}
              </span>
              {detail ? (
                <span
                  className={`text-[0.8125rem] leading-snug ${s.state === 'todo' ? 'opacity-55' : 'opacity-70'}`}
                >
                  {detail}
                </span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
