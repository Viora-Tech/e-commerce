import type { ReactNode } from 'react'
import type { Image } from '../../../sections/framed'
import type { CardProduct } from '../../../types'

/**
 * One merchant-typed review, ready to draw. `name` and `body` are strings in storage but React
 * nodes while edited on the canvas; `product` is the reviewed product, already loaded.
 */
export type ReviewEntry = {
  name: ReactNode
  body: ReactNode
  rating: number
  date: string
  verified: boolean
  photo: Image | undefined
  product: CardProduct | null
}
