'use client'

import { useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'

type ChatContactFormProps = {
  required: boolean
  onDone: (contact: { name: string; email: string; phone: string } | null) => void
}

const field =
  'w-full rounded-xl border border-[color-mix(in_srgb,currentColor_18%,transparent)] bg-transparent px-3 py-2 text-[1rem] outline-none focus-visible:border-[currentColor]'

/** "How can we reach you?": an email or phone so the store can reply after the shopper leaves. */
export default function ChatContactForm({ required, onDone }: ChatContactFormProps) {
  // Hooks
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Render logic
  const ready = /\S+@\S+\.\S+/.test(email.trim()) || phone.replace(/\D/g, '').length >= 10

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-[color-mix(in_srgb,currentColor_12%,transparent)] p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) onDone({ name: name.trim(), email: email.trim(), phone: phone.trim() })
      }}
    >
      <p className="text-[0.875rem] font-medium">{copy.contact.title}</p>
      <p className="text-[0.75rem] opacity-70">
        {required ? copy.contact.required : copy.contact.help}
      </p>
      <input
        className={field}
        placeholder={copy.contact.name}
        aria-label={copy.contact.name}
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className={field}
        type="email"
        placeholder={copy.contact.email}
        aria-label={copy.contact.email}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className={field}
        type="tel"
        inputMode="tel"
        placeholder={copy.contact.phone}
        aria-label={copy.contact.phone}
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        {required ? null : (
          <button
            type="button"
            className="px-3 py-1.5 text-[0.8125rem] underline"
            onClick={() => onDone(null)}
          >
            {copy.contact.skip}
          </button>
        )}
        <button
          type="submit"
          disabled={!ready}
          className="rounded-full bg-[var(--btn-bg,var(--color-ink,CanvasText))] px-4 py-1.5 text-[0.8125rem] font-medium text-[var(--btn-text,var(--color-bg,Canvas))] disabled:opacity-40"
        >
          {copy.contact.save}
        </button>
      </div>
    </form>
  )
}
