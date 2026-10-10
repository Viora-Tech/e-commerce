// Pattern after common "how it works" layouts (our own implementation). See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import KitHeading from './kit-heading'

/** Copy is a string in storage, a React node while edited on the canvas. */
type FeatureStepsProps = {
  heading: ReactNode
  text: ReactNode
  steps: { title: ReactNode; text: ReactNode }[]
}

/** Numbered steps in a row joined by a hairline (a column on phones). */
export default function FeatureSteps({ heading, text, steps }: FeatureStepsProps) {
  // Early returns
  if (!steps?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col gap-[2.5rem]">
      <KitHeading heading={heading} text={text} />
      <ol className="grid grid-cols-1 gap-[2rem] md:grid-flow-col md:auto-cols-fr md:gap-[1.5rem]">
        {steps.map((step, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <li key={i} className="relative flex flex-col gap-[0.75rem] text-left">
            <div className="flex items-center gap-[1rem]">
              <span className="flex size-[2.5rem] shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)] text-[1rem] font-semibold text-[var(--color-on-brand)] tabular-nums">
                {i + 1}
              </span>
              {i < steps.length - 1 ? (
                <span aria-hidden className="hidden h-px flex-1 bg-[var(--color-line)] md:block" />
              ) : null}
            </div>
            {step.title ? <h3 className="h5 text-[var(--color-ink)]">{step.title}</h3> : null}
            {step.text ? <p className="text-small text-[var(--color-muted)]">{step.text}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
