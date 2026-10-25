import type { ComponentConfig } from '@puckeditor/core'
import WhatsappChat from '../../components/sections/zero-drift/whatsapp-chat'
import { whatsappChatContent as copy } from '../../data/zero-drift/whatsapp-chat'
import { inlineText } from '../inline-fields'

export type WhatsappChatProps = {
  number: string
  name: string
  replyTime: string
  greeting: string
  message: string
  button: string
  start: string
}

const f = copy.fields

/**
 * The WhatsApp chat button (Figma Section / WhatsApp chat button): a floating section, like the
 * sign-up popup, usually placed once in the footer group so it shows on every page.
 */
export function whatsappChatSection(): ComponentConfig {
  const config: ComponentConfig<WhatsappChatProps> = {
    label: copy.label,
    fields: {
      number: { type: 'text', label: f.number },
      name: inlineText(f.name),
      replyTime: inlineText(f.replyTime),
      greeting: inlineText(f.greeting),
      message: { type: 'textarea', label: f.message },
      button: inlineText(f.button),
      start: inlineText(f.start),
    },
    defaultProps: { ...copy.defaults },
    render: ({ puck, ...p }) => <WhatsappChat {...p} editing={Boolean(puck?.isEditing)} />,
  }
  return config as unknown as ComponentConfig
}
