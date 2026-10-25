import type { ReactNode } from 'react'
import ElementBox from './element-box'

export type BadgeProps = {
  /** A string in storage, a React node while edited on the canvas. */
  text: ReactNode
  tone: 'brand' | 'accent' | 'success' | 'danger' | 'neutral'
  style: unknown
}

const TONES: Record<BadgeProps['tone'], string> = {
  brand: 'bg-[var(--color-brand)] text-[var(--color-on-brand)]',
  accent: 'bg-[var(--color-accent)] text-[var(--color-bg)]',
  success: 'bg-[var(--color-success)] text-white',
  danger: 'bg-[var(--color-danger)] text-white',
  neutral: 'bg-[var(--color-surface)] text-[var(--color-ink)]',
}

/** A small pill label ("New", "Bestseller"). */
export default function BadgeElement({ text, tone, style }: BadgeProps) {
  // Render logic
  return (
    <ElementBox look={style} className="custom-badge inline-flex">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone] ?? TONES.brand}`}
      >
        {text}
      </span>
    </ElementBox>
  )
}
