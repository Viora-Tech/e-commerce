/** SOURCE OF TRUTH: preorder countdown app block — wires the core plugin's storefront
 *  block onto @commerce/blocks/PreorderCountdownBlock via puck.metadata.appBlockContext. */
import { PreorderCountdownBlock, type PreorderCountdownContext } from '@commerce/blocks'
import type { AppBlockDefinition } from '@commerce/plugins'

type CountdownFields = { label: string; style: 'compact' | 'large' }

function render(props: CountdownFields & { puck?: { metadata?: Record<string, unknown> } }) {
  const context = (
    props.puck?.metadata?.appBlockContext as
      | { preorderCountdown?: PreorderCountdownContext }
      | undefined
  )?.preorderCountdown
  return <PreorderCountdownBlock label={props.label} style={props.style} context={context} />
}

/**
 * The core plugin's storefront block: the pre-order launch countdown, for a
 * merchant who wants it somewhere other than under the buy box (a banner
 * near the top of the page, for instance). Every deployment has the core
 * plugin, so this block is always in the Add panel — no separate package,
 * since pre-order is a core commerce feature, not an app. No DB import, so
 * this file is safe to import from the admin editor's client bundle
 * (`@commerce/core/preorder-block`) as well as from `core-plugin.ts`.
 */
export const preorderBlocks: AppBlockDefinition[] = [
  {
    type: 'core/PreorderCountdown',
    label: 'Pre-order countdown',
    description: 'Launch countdown for a pre-order product, anywhere on the product page.',
    icon: 'Timer',
    fields: {
      label: { type: 'text', label: 'Label' },
      style: {
        type: 'radio',
        label: 'Style',
        options: [
          { label: 'Compact', value: 'compact' },
          { label: 'Large', value: 'large' },
        ],
      },
    },
    defaultProps: { label: 'Launches in', style: 'compact' },
    render,
  },
]
