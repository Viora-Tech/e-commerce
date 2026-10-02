import { type AnswerSpan, parseAnswer } from '@/lib/ai-answer'

type AssistantAnswerProps = {
  /** Light markdown from the model, possibly half-streamed. */
  text: string
}

/** The model's words as paragraphs and bullet lists. Plain React text: no HTML from the model. */
export default function AssistantAnswer({ text }: AssistantAnswerProps) {
  // Render logic
  const blocks = parseAnswer(text)

  return (
    <div className="flex flex-col gap-2 text-body text-ink-strong">
      {blocks.map((block, i) =>
        block.type === 'p' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are re-parsed from streamed text
          <p key={i}>
            <Spans spans={block.spans} />
          </p>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are re-parsed from streamed text
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
            {block.items.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: list items are re-parsed from streamed text
              <li key={j}>
                <Spans spans={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}

function Spans({ spans }: { spans: AnswerSpan[] }) {
  return spans.map((s, i) =>
    s.bold ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: spans have no identity beyond their order
      <strong key={i} className="font-semibold text-ink-strong">
        {s.text}
      </strong>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: spans have no identity beyond their order
      <span key={i}>{s.text}</span>
    ),
  )
}
