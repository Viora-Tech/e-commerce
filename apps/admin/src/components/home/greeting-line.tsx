'use client'

import type { ReactNode } from 'react'
import CountUp from '@/components/layout/count-up'

type GreetingLineProps = {
  /** The full translated sentence, e.g. "3 orders today worth ₹43,699, 2 need shipping." */
  line: string
  /** The exact formatted sales figure inside it, e.g. "₹43,699". */
  salesText: string
  /** The exact order count inside it, e.g. "3". */
  ordersText: string
}

function splitOnce(text: string, needle: string): [string, string] | null {
  if (!needle) return null
  const at = text.indexOf(needle)
  if (at < 0) return null
  return [text.slice(0, at), text.slice(at + needle.length)]
}

/**
 * The sentence under the greeting, with today's sales and order count counting up once
 * (motion spec 02). The split is on the exact formatted substrings, so it holds in every
 * language; when a value is missing (an empty day) the plain sentence shows.
 */
export default function GreetingLine({ line, salesText, ordersText }: GreetingLineProps) {
  // Render logic
  const saleSplit = splitOnce(line, salesText)
  if (!saleSplit) return <p className="text-body text-muted-foreground">{line}</p>
  const [before, after] = saleSplit
  const orderSplit = splitOnce(before, ordersText)
  const head: ReactNode =
    orderSplit === null ? (
      before
    ) : (
      <>
        {orderSplit[0]}
        <CountUp value={ordersText} />
        {orderSplit[1]}
      </>
    )

  return (
    <p className="text-body text-muted-foreground tabular-nums">
      {head}
      <CountUp value={salesText} />
      {after}
    </p>
  )
}
