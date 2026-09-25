import { NotifyMeBlock, type NotifyMeBlockContext } from '@commerce/blocks'
import type { AppBlockDefinition } from '@commerce/plugins'
import { notifyMeBlockCopy as copy } from './copy'

type NotifyMeFields = { buttonLabel: string; helperText: string; align: 'left' | 'center' }

function render(props: NotifyMeFields & { puck?: { metadata?: Record<string, unknown> } }) {
  const context = (
    props.puck?.metadata?.appBlockContext as { notifyMe?: NotifyMeBlockContext } | undefined
  )?.notifyMe
  return (
    <NotifyMeBlock
      buttonLabel={props.buttonLabel}
      helperText={props.helperText}
      align={props.align}
      context={context}
      copy={copy}
    />
  )
}

/**
 * The back-in-stock app's storefront block: sold-out email/phone capture
 * outside the buy box, for a merchant who wants it elsewhere on the product
 * page. Reuses `createSignup` — the same subscribe flow the built-in buy-box
 * form uses — via the `action` the product page route binds into
 * `appBlockContext.notifyMe` (see apps/storefront/src/lib/template-render.tsx
 * and the product page). No DB or Next.js import here, so this file is safe
 * to import from the admin editor's client bundle too.
 */
export const backInStockBlocks: AppBlockDefinition[] = [
  {
    type: 'back-in-stock/NotifyMe',
    label: 'Notify me',
    description: 'Email/phone capture for a sold-out variant, anywhere on the product page.',
    icon: 'Bell',
    fields: {
      buttonLabel: { type: 'text', label: 'Button label' },
      helperText: { type: 'textarea', label: 'Helper text' },
      align: {
        type: 'radio',
        label: 'Align',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
        ],
      },
    },
    defaultProps: { buttonLabel: copy.buttonLabel, helperText: copy.helperText, align: 'left' },
    render,
  },
]
