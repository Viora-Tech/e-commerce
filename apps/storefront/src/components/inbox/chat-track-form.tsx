'use client'

import { usePathname } from 'next/navigation'
import { type FormEvent, useId, useState } from 'react'
import { chatTrackContent } from '@/data/chat-track'
import type { ChatOrderView } from '@/lib/chat-track'
import { chatTrackOrderAction } from '@/lib/chat-track-actions'

type ChatTrackFormProps = {
  /** Signed-in shoppers already saw their orders: no sign-in line. */
  signedIn: boolean
  onFound: (order: ChatOrderView) => void
}

const copy = chatTrackContent.form

const field =
  'h-11! w-full! rounded-[0.625rem]! border! border-[color-mix(in_srgb,currentColor_18%,transparent)]! bg-transparent! px-3! text-[1rem]! outline-none! placeholder:opacity-50! focus-visible:border-[currentColor]!'

const label = 'text-[0.8125rem]! font-semibold!'

type Problem = 'not-found' | 'limited' | 'failed' | null

/** The guest lookup: the email or mobile on the order and its number. */
export default function ChatTrackForm({ signedIn, onFound }: ChatTrackFormProps) {
  // Hooks
  const pathname = usePathname()
  const id = useId()
  const [contact, setContact] = useState('')
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)

  // Event handlers
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy || !contact.trim() || !number.trim()) return
    setBusy(true)
    setProblem(null)
    try {
      const result = await chatTrackOrderAction({ contact, number })
      if (result.status === 'found') onFound(result.order)
      else setProblem(result.status)
    } catch {
      setProblem('failed')
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const message = problem ? copy[problem === 'not-found' ? 'notFound' : problem] : null
  const signInHref = `/account/login?return_to=${encodeURIComponent(pathname || '/')}`

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={busy}
      className="flex flex-col gap-3 rounded-[0.875rem] bg-[var(--color-bg,Canvas)] p-3.5 ring-1 ring-[color-mix(in_srgb,currentColor_8%,transparent)]"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-contact`} className={label}>
          {copy.contact}
        </label>
        <input
          id={`${id}-contact`}
          name="contact"
          className={field}
          placeholder={copy.contactPlaceholder}
          autoComplete="email"
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-number`} className={label}>
          {copy.number}
        </label>
        <input
          id={`${id}-number`}
          name="number"
          className={field}
          placeholder={copy.numberPlaceholder}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          required
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <span id={`${id}-hint`} className="text-[0.75rem]! opacity-60">
          {copy.numberHint}
        </span>
      </div>
      <p
        aria-live="polite"
        className="text-[0.8125rem]! leading-snug! text-[var(--color-danger,currentColor)] empty:hidden"
      >
        {message}
      </p>
      <button
        type="submit"
        disabled={busy}
        className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-[0.625rem] bg-(--chat-accent)! px-4 text-[0.9375rem]! font-semibold! text-(--chat-on-accent)! transition-[opacity,scale] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) disabled:opacity-60"
      >
        {busy ? copy.finding : copy.submit}
      </button>
      {signedIn ? null : (
        <p className="text-[0.75rem]! leading-snug! opacity-70">
          {copy.signedInLine}{' '}
          <a href={signInHref} className="font-semibold! underline">
            {copy.signIn}
          </a>
        </p>
      )}
    </form>
  )
}
