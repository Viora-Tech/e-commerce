'use client'

import { type ReactNode, useId, useState } from 'react'
import { whatsappChatContent as copy } from '../../../data/zero-drift/whatsapp-chat'
import Icon from '../../icon'

type WhatsappChatProps = {
  /** Digits only, with the country code (919876543210); none hides the button on the store. */
  number: string
  name: ReactNode
  replyTime: ReactNode
  greeting: ReactNode
  /** The text the chat opens with in WhatsApp. */
  message: string
  button: ReactNode
  start: ReactNode
  /** The Customize canvas: drawn in place, open, with a note while the number is missing. */
  editing?: boolean | undefined
}

/** wa.me with the message filled in, or null without a usable number. */
function chatHref(number: string, message: string): string | null {
  const digits = number.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return null
  return `https://wa.me/${digits}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ''}`
}

/**
 * Figma Section / WhatsApp chat button (709:124828): a green "Chat with us" pill fixed to the
 * bottom-right; it opens a small card with who answers, how fast, a greeting and "Start chat
 * on WhatsApp", which opens the conversation with the message filled in.
 */
export default function WhatsappChat({
  number,
  name,
  replyTime,
  greeting,
  message,
  button,
  start,
  editing = false,
}: WhatsappChatProps) {
  // Hooks
  const id = useId()
  const [open, setOpen] = useState(editing)

  // Helpers
  const href = chatHref(number, message)

  // Early returns
  if (!href && !editing) return null

  // Render logic
  const cardId = `${id}-card`

  return (
    <div className={`whatsapp-chat${editing ? ' whatsapp-chat--editing' : ''}`}>
      {editing && !href ? <p className="whatsapp-chat__note">{copy.editorNote}</p> : null}
      {open ? (
        <div id={cardId} className="whatsapp-chat__card" role="dialog" aria-label={copy.label}>
          <div className="whatsapp-chat__head">
            <span className="whatsapp-chat__avatar" aria-hidden="true">
              <Icon name="whatsapp" size={18} />
            </span>
            <span className="whatsapp-chat__who">
              <span className="whatsapp-chat__name">{name}</span>
              <span className="whatsapp-chat__reply">{replyTime}</span>
            </span>
          </div>
          <p className="whatsapp-chat__greeting">{greeting}</p>
          <a
            className="btn btn--primary whatsapp-chat__start"
            href={href ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
          >
            {start}
          </a>
        </div>
      ) : null}
      <button
        type="button"
        className="whatsapp-chat__toggle"
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        aria-label={open ? copy.close : copy.open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={open ? 'close' : 'whatsapp'} size={18} />
        <span>{button}</span>
      </button>
    </div>
  )
}
