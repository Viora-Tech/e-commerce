'use client'

import { inboxChatContent as copy } from '@/data/inbox'
import ChatIcon from './chat-icon'

export type ChatMode = 'float' | 'expanded' | 'docked'

type ChatHeaderProps = {
  storeName: string
  logoUrl?: string | null | undefined
  available: boolean
  mode: ChatMode
  onMode: (mode: ChatMode) => void
  onClose: () => void
  /**
   * The page around the chat is desktop-wide although the card is not: the plain HTML page's chat
   * frame is only as wide as the card, so the `sm:` breakpoint cannot tell. Null: ask the breakpoint.
   */
  wide?: boolean | null | undefined
}

const HAIRLINE = 'border-[color-mix(in_srgb,currentColor_8%,transparent)]'
const ICON_BUTTON =
  'flex size-9 touch-manipulation items-center justify-center rounded-[0.625rem] opacity-60 transition-[opacity,background-color,scale] duration-(--duration-press) ease-out hover:bg-[color-mix(in_srgb,currentColor_6%,transparent)] hover:opacity-100 active:scale-(--motion-press-scale)'

/** The chat card's top bar: the store's logo (or initial), name and online line, then full screen, dock and minimise. */
export default function ChatHeader({
  storeName,
  logoUrl,
  available,
  mode,
  onMode,
  onClose,
  wide,
}: ChatHeaderProps) {
  // Render logic
  const desktopOnly = wide == null ? 'hidden! sm:flex!' : wide ? 'flex!' : 'hidden!'
  const phoneIcon = wide == null ? 'sm:hidden!' : wide ? 'hidden!' : ''
  const desktopIcon = wide == null ? 'hidden! sm:block!' : wide ? 'block!' : 'hidden!'
  const initial = storeName.trim().charAt(0).toUpperCase() || '?'

  return (
    <header
      className={`flex items-center gap-3 border-b px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:pt-3 ${HAIRLINE}`}
    >
      {logoUrl ? (
        // biome-ignore lint/performance/noImgElement: the theme's logo on the store's storage host
        <img
          src={logoUrl}
          alt=""
          className={`size-10! shrink-0 rounded-[0.75rem] border object-contain! p-1! ${HAIRLINE}`}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-[var(--color-ink,CanvasText)] text-[1rem]! font-semibold! text-[var(--color-bg,Canvas)]"
        >
          {initial}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.9375rem]! font-semibold!">{storeName}</span>
        <span className="flex items-center gap-1.5 text-[0.75rem]! opacity-60">
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full ${available ? 'bg-[var(--color-success,currentColor)]' : 'bg-[color-mix(in_srgb,currentColor_40%,transparent)]'}`}
          />
          <span className="truncate">{available ? copy.online : copy.offline}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {mode === 'float' ? null : (
          <button
            type="button"
            className={`${ICON_BUTTON} ${desktopOnly}`}
            aria-label={mode === 'docked' ? copy.undock : copy.dock}
            onClick={() => onMode(mode === 'docked' ? 'float' : 'docked')}
          >
            <ChatIcon kind="dock" className="size-4" />
          </button>
        )}
        <button
          type="button"
          className={`${ICON_BUTTON} ${desktopOnly}`}
          aria-label={mode === 'expanded' ? copy.restore : copy.expand}
          onClick={() => onMode(mode === 'expanded' ? 'float' : 'expanded')}
        >
          <ChatIcon kind={mode === 'expanded' ? 'shrink' : 'expand'} className="size-4" />
        </button>
        <button type="button" className={ICON_BUTTON} aria-label={copy.close} onClick={onClose}>
          <ChatIcon kind="chevronDown" className={`size-5 ${phoneIcon}`} />
          <ChatIcon kind="minimise" className={`size-4 ${desktopIcon}`} />
        </button>
      </div>
    </header>
  )
}
