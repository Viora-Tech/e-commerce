'use client'

import { type KeyboardEvent, useRef, useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'
import ChatIcon from './chat-icon'

type ChatComposerProps = {
  disabled: boolean
  /** Shown above the field when sending is not possible (sign in, closed chat). */
  notice?: string | undefined
  onSend: (text: string, website: string) => void
  onPhoto: (file: File) => void
  onTyping: () => void
  uploading: boolean
}

/** The big rounded "Ask anything…" field, a photo button and Send. Enter sends. */
export default function ChatComposer({
  disabled,
  notice,
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

  return (
    <div className="flex flex-col gap-2">
      {notice ? <p className="text-[0.8125rem] opacity-70">{notice}</p> : null}
      {uploading ? <p className="text-[0.75rem] opacity-60">{copy.uploading}</p> : null}
      <div className="flex items-end gap-2 rounded-3xl border border-[color-mix(in_srgb,currentColor_18%,transparent)] bg-[var(--color-bg,Canvas)] px-3 py-2">
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
          className="shrink-0 touch-manipulation rounded-full p-1.5 opacity-70 hover:opacity-100 disabled:opacity-30"
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
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[1rem] outline-none placeholder:opacity-50"
        />
        <button
          type="button"
          aria-label={copy.send}
          disabled={disabled || !draft.trim()}
          onClick={handleSend}
          className="shrink-0 touch-manipulation rounded-full bg-[var(--btn-bg,var(--color-ink,CanvasText))] p-2 text-[var(--btn-text,var(--color-bg,Canvas))] transition-[scale,opacity] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) disabled:opacity-40"
        >
          <ChatIcon kind="send" className="size-4" />
        </button>
      </div>
    </div>
  )
}
