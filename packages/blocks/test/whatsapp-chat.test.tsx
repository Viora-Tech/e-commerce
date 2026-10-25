import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import WhatsappChat from '../src/components/sections/zero-drift/whatsapp-chat'

const base = {
  name: 'Support',
  replyTime: 'Typically replies in 10 min',
  greeting: 'Hi!',
  message: 'Hi, I have a question.',
  button: 'Chat with us',
  start: 'Start chat on WhatsApp',
}

describe('WhatsappChat', () => {
  it('draws nothing on the store without a usable number', () => {
    expect(renderToStaticMarkup(<WhatsappChat {...base} number="" />)).toBe('')
    expect(renderToStaticMarkup(<WhatsappChat {...base} number="12345" />)).toBe('')
  })

  it('shows the pill, closed, with a usable number', () => {
    const html = renderToStaticMarkup(<WhatsappChat {...base} number="+91 98765 43210" />)
    expect(html).toContain('Chat with us')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('whatsapp-chat__card')
  })

  it('opens on the canvas with the chat link and the message filled in', () => {
    const html = renderToStaticMarkup(<WhatsappChat {...base} number="919876543210" editing />)
    expect(html).toContain(
      'href="https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20question."',
    )
    expect(html).toContain('rel="noopener noreferrer"')
  })
})
