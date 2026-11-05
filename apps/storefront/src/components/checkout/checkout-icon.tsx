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
  | 'shield'
  | 'bag'
  | 'whatsapp'
  | 'refresh'

type CheckoutIconProps = {
  name: CheckoutIconName
  className?: string
}

/** 24-unit line drawings in the current text colour; one stroke weight for the whole checkout. WhatsApp is its solid mark. */
const PATHS: Record<CheckoutIconName, ReactNode> = {
  whatsapp: (
    <path
      fill="currentColor"
      stroke="none"
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
    />
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  refresh: (
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" />
  ),
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
  shield: (
    <>
      <path d="M12 3.5l7 2.75v5.25c0 4.25-2.9 7.6-7 9-4.1-1.4-7-4.75-7-9V6.25z" />
      <path d="M9 12l2.25 2.25L15.5 10" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8h13l-1 12h-11z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
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
