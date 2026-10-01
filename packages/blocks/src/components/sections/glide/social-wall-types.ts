import type { Image } from '../../../sections/framed'

export type Platform = 'instagram' | 'x' | 'youtube'

export type SocialPost = {
  platform: Platform
  image: Image
  videoId: string
  link: string
  caption: string
}
