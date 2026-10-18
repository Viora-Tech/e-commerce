import type { ReactNode } from 'react'

export type CheckoutIconName =
  | 'back'
  | 'chevron'
  | 'lock'
  | 'check'
  | 'alert'
  | 'phone'
  | 'card'
  | 'cash'
  | 'bank'
  | 'truck'
  | 'tag'
  | 'gift'
  | 'clock'
  | 'mail'
  | 'edit'
  | 'trash'
  | 'plus'
  | 'user'
  | 'bolt'
  | 'spinner'
  | 'chat'

type CheckoutIconProps = {
  name: CheckoutIconName
  className?: string
}

/** 24-unit line drawings in the current text colour; one stroke weight for the whole checkout. */
const PATHS: Record<CheckoutIconName, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chat: <path d="M4 12a8 8 0 1 1 3.1 6.3L4 19.5l1.1-3.3A7.9 7.9 0 0 1 4 12Z" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5M12 15.8v.2" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M11 17.5h2" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 14.5h3" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <circle cx="12" cy="12" r="2.25" />
      <path d="M6.5 10v4M17.5 10v4" />
    </>
  ),
  bank: <path d="M4 10h16M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3.5 19.5h17M12 4l8 4H4l8-4z" />,
  truck: (
    <>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.75" />
      <circle cx="17" cy="17.5" r="1.75" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5V5a1.5 1.5 0 0 1 1.5-1.5h7.5L20.5 11.5l-9 9z" />
      <circle cx="8" cy="8" r="1.25" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M12 9v11M4 13h16M12 9c-1.5-3.5-5-4-5-1.5S10 9 12 9zm0 0c1.5-3.5 5-4 5-1.5S14 9 12 9z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  edit: (
    <path d="M14.5 5.5l4 4M4 20l1-4.5L15.5 5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L8.5 19z" />
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 10.5v6M14 10.5v6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.2 3.8-5 7-5s5.8 1.8 7 5" />
    </>
  ),
  bolt: <path d="M13 3.5L5.5 13.5H12l-1 7 7.5-10H12z" />,
  spinner: <path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />,
}

/** Small line icons for the checkout, drawn inline so they need no request and no font. */
export default function CheckoutIcon({ name, className = 'size-4' }: CheckoutIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`inline-block! h-auto shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  )
}
