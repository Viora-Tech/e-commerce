import type { ReactNode } from 'react'
import ElementBox from './element-box'

export type HeadingProps = {
  /** A string in storage, a React node while edited on the canvas. */
  text: ReactNode
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  style: unknown
}

const LEVELS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** A heading at the level the merchant picks, in the theme's heading type (`.h1` … `.h6`). */
export default function HeadingElement({ text, level, style }: HeadingProps) {
  // Render logic
  const tag = LEVELS.has(level) ? level : 'h2'
  return (
    <ElementBox look={style} as={tag} className={`custom-heading ${tag} m-0 text-balance`}>
      {text}
    </ElementBox>
  )
}
