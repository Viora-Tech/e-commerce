import { ReviewsFloatingTab, type StoreReviews } from '@commerce/blocks'
import type { AppEmbedDefinition } from '@commerce/plugins'
import { REVIEWS_ID } from './settings'

/** How many recent reviews the floating tab's panel lists. */
export const FLOATING_TAB_REVIEWS = 10

/** The floating tab's type, namespaced like every app embed. */
export const FLOATING_TAB = `${REVIEWS_ID}/FloatingTab`

type FloatingTabProps = {
  label: string
  heading: string
  position: 'left' | 'right'
  minRating: number
  showProduct: boolean
  /** Loaded by the storefront for this embed (`app-embed-data.ts`); missing in the editor. */
  data?: StoreReviews | null | undefined
}

const yesNo = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
]

/**
 * The Reviews app's embed: a floating "Reviews" tab on the side of every page that opens a
 * panel of recent published reviews. Turned on per theme in the theme editor's Apps panel. The
 * storefront loads the reviews and hands them over as `data`; no DB or Next.js import here, so
 * the admin editor's client bundle can import it too. The other review widgets are theme
 * sections (`reviews/*` in `@commerce/blocks`), which read reviews through the blocks loaders.
 */
export const reviewsEmbeds: AppEmbedDefinition[] = [
  {
    type: FLOATING_TAB,
    label: 'Floating reviews tab',
    description: 'A tab on the side of every page that opens your latest reviews.',
    fields: {
      label: { type: 'text', label: 'Tab text' },
      heading: { type: 'text', label: 'Panel heading' },
      position: {
        type: 'radio',
        label: 'Side of the screen',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      minRating: {
        type: 'select',
        label: 'Lowest star rating to show',
        options: [
          { label: 'Any', value: 1 },
          { label: '3 stars and up', value: 3 },
          { label: '4 stars and up', value: 4 },
          { label: '5 stars only', value: 5 },
        ],
      },
      showProduct: { type: 'radio', label: 'Show the product name', options: yesNo },
    },
    defaultProps: {
      label: 'Reviews',
      heading: 'What customers say',
      position: 'right',
      minRating: 4,
      showProduct: true,
    },
    render: (props: FloatingTabProps) => (
      <ReviewsFloatingTab
        label={props.label}
        heading={props.heading}
        position={props.position === 'left' ? 'left' : 'right'}
        showProduct={props.showProduct !== false}
        data={props.data}
      />
    ),
  },
]
