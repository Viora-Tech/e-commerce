import { createUsePuck } from '@puckeditor/core'

/** Selector hook over the Customize Puck store; every panel reads and dispatches through it. */
export const useCustomizePuck = createUsePuck()

/** Section catalogue for the add menu: Puck's categories with an icon per section. */
export const SECTION_ICONS: Record<string, string> = {
  Hero: 'image',
  ImageBanner: 'image',
  ImageWithText: 'image',
  AnnouncementBar: 'megaphone',
  RichText: 'text',
  Multicolumn: 'columns',
  Testimonials: 'quote',
  Faq: 'list',
  LogoList: 'shapes',
  ProductGrid: 'grid',
  FeaturedProducts: 'grid',
  CollectionGrid: 'grid',
  FeaturedProduct: 'package',
  CollectionList: 'folder',
  RelatedProducts: 'grid',
  RecentlyViewed: 'grid',
  Video: 'video',
  BlogPosts: 'news',
  Newsletter: 'send',
}
