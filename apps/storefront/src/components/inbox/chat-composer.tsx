'use client'

import { type KeyboardEvent, useRef, useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'
import ChatIcon from './chat-icon'

type ChatComposerProps = {
  disabled: boolean
  /** Shown above the field when sending is not possible (sign in, closed chat). */
  notice?: string | undefined
  storeName: string
  /** Guests get a small "Sign in" link in the line under the field. */
  signInHref: string | null
  onSend: (text: string, website: string) => void
  onPhoto: (file: File) => void
  onTyping: () => void
  uploading: boolean
}

/**
 * One rounded field: a photo button, "Ask anything…" and the accent Send. Enter sends. Under it
 * the line about who answers, the privacy link and, for guests, Sign in.
 */
export default function ChatComposer({
  disabled,
  notice,
  storeName,
  signInHref,
  onSend,
  onPhoto,
  onTyping,
  uploading,
}: ChatComposerProps) {
  // Hooks
  const [draft, setDraft] = useState('')
  const [website, setWebsite] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Event handlers
  const handleSend = () => {
    const text = draft.trim()
    if (!text || disabled) return
    onSend(text, website)
    setDraft('')
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  // Render logic
  const link = 'underline-offset-2 hover:underline'

  return (
    <div className="flex flex-col gap-2">
      {notice ? <p className="text-[0.8125rem]! opacity-70">{notice}</p> : null}
      {uploading ? <p className="text-[0.75rem]! opacity-60">{copy.uploading}</p> : null}
      <div className="flex items-end gap-1 rounded-[0.875rem] bg-[var(--color-bg,Canvas)] p-1.5 ring-1 ring-[color-mix(in_srgb,currentColor_12%,transparent)] transition-[box-shadow] duration-(--duration-press) focus-within:ring-[color-mix(in_srgb,currentColor_28%,transparent)]">
        {/* A field people never see; a bot that fills it is ignored. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute -left-[625rem] size-px opacity-0"
        />
        <button
          type="button"
          aria-label={copy.attach}
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
          className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-[0.625rem] opacity-60 transition-[opacity,background-color,scale] duration-(--duration-press) ease-out hover:bg-[color-mix(in_srgb,currentColor_6%,transparent)] hover:opacity-100 active:scale-(--motion-press-scale) disabled:opacity-30"
        >
          <ChatIcon kind="photo" className="size-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPhoto(file)
            e.target.value = ''
          }}
        />
        <textarea
          value={draft}
          rows={1}
          maxLength={2000}
          disabled={disabled}
          placeholder={copy.placeholder}
          aria-label={copy.placeholder}
          onChange={(e) => {
            setDraft(e.target.value)
            if (e.target.value.trim()) onTyping()
          }}
          onKeyDown={handleKeyDown}
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1 py-[0.4375rem] text-[1rem]! leading-snug! outline-none placeholder:opacity-50"
        />
        <button
          type="button"
          aria-label={copy.send}
          disabled={disabled || !draft.trim()}
          onClick={handleSend}
          className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-[0.625rem] bg-(--chat-accent)! text-(--chat-on-accent)! transition-[scale,opacity] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) disabled:opacity-35 disabled:active:scale-100"
        >
          <ChatIcon kind="send" className="size-[1.125rem]" />
        </button>
      </div>
      <p className="text-center text-[0.71875rem]! opacity-55">
        {copy.footnote(storeName)} ·{' '}
        <a href="/policies/privacy-policy" className={link}>
          {copy.privacy}
        </a>
        {signInHref ? (
          <>
            {' · '}
            <a href={signInHref} className={`${link} font-medium!`}>
              {copy.signIn}
            </a>
          </>
        ) : null}
      </p>
    </div>
  )
}
