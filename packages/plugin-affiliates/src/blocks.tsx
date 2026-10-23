import { AffiliateSignupBlock } from '@commerce/blocks'
import type { AppBlockDefinition } from '@commerce/plugins'
import { affiliateSignupBlockCopy as copy } from './copy'

type AffiliateSignupFields = {
  heading: string
  text: string
  buttonLabel: string
  align: 'left' | 'center'
}

function render(props: AffiliateSignupFields) {
  return (
    <AffiliateSignupBlock
      heading={props.heading}
      text={props.text}
      buttonLabel={props.buttonLabel}
      align={props.align}
    />
  )
}

/**
 * The Affiliates app's theme block: an invitation with a button to the store's `/affiliate`
 * signup page, placeable on any template. No DB or Next.js import here, so the admin editor's
 * client bundle can import it (`commerce.blocks.config.ts`).
 */
export const affiliateBlocks: AppBlockDefinition[] = [
  {
    type: 'affiliates/AffiliateSignup',
    label: 'Affiliate signup',
    description: 'Invite shoppers and creators to join your affiliate program.',
    icon: 'Users',
    fields: {
      heading: { type: 'text', label: 'Heading' },
      text: { type: 'textarea', label: 'Text' },
      buttonLabel: { type: 'text', label: 'Button label' },
      align: {
        type: 'radio',
        label: 'Align',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
        ],
      },
    },
    defaultProps: { ...copy, align: 'center' },
    render,
  },
]
