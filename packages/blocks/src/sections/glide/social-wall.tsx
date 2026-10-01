import type { ComponentConfig } from '@puckeditor/core'
import SocialWall from '../../components/sections/glide/social-wall'
import type { SocialPost } from '../../components/sections/glide/social-wall-types'
import { socialWallContent as copy } from '../../data/glide/social-wall'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, framed, imageField, noImage } from '../framed'
import { inlineText } from '../inline-fields'
import type { GlideLoaders } from './loaders'

export type SocialWallProps = Frame & {
  heading: string
  subheading: string
  layout: 'grid' | 'carousel'
  autoscroll: boolean
  scrollSeconds: number
  showTabs: boolean
  instagramUrl: string
  xUrl: string
  youtubeUrl: string
  posts: SocialPost[]
}

const defaults: Omit<SocialWallProps, keyof Frame> = {
  heading: copy.heading,
  subheading: copy.subheading,
  layout: 'carousel',
  autoscroll: true,
  scrollSeconds: copy.autoscrollSeconds,
  showTabs: true,
  instagramUrl: '',
  xUrl: '',
  youtubeUrl: '',
  // No Instagram API: the merchant enters every post. Theme defaults keep their links and captions.
  posts: copy.posts.map((p) => ({ ...p, image: noImage, videoId: '' })),
}

// Port of sections/social-wall.liquid. No loaders: posts are entered by hand.
export function socialWallSection(_loaders: GlideLoaders): ComponentConfig {
  return framed<SocialWallProps>(
    copy.label,
    {
      heading: inlineText(copy.fields.heading),
      subheading: inlineText(copy.fields.subheading),
      layout: { type: 'radio', label: copy.fields.layout, options: copy.layoutOptions },
      autoscroll: { type: 'radio', label: copy.fields.autoscroll, options: copy.yesNo },
      scrollSeconds: { type: 'number', label: copy.fields.scrollSeconds, min: 20, max: 90 },
      showTabs: { type: 'radio', label: copy.fields.showTabs, options: copy.yesNo },
      instagramUrl: { type: 'text', label: copy.fields.instagramUrl },
      xUrl: { type: 'text', label: copy.fields.xUrl },
      youtubeUrl: { type: 'text', label: copy.fields.youtubeUrl },
      posts: {
        type: 'array',
        label: copy.fields.posts,
        max: 12,
        getItemSummary: (p: SocialPost) => p.caption || copy.postSummaryFallback,
        defaultItemProps: {
          platform: 'instagram',
          image: noImage,
          videoId: '',
          link: '',
          caption: '',
        },
        arrayFields: {
          platform: {
            type: 'select',
            label: copy.fields.postPlatform,
            options: copy.platformOptions,
          },
          image: imageField(copy.fields.postImage),
          videoId: { type: 'text', label: copy.fields.postVideoId },
          link: { type: 'text', label: copy.fields.postLink },
          caption: { type: 'text', label: copy.fields.postCaption },
        },
      },
    },
    defaults,
    (p) => (
      <SocialWall
        heading={p.heading}
        subheading={p.subheading}
        layout={p.layout}
        autoscroll={p.autoscroll}
        scrollSeconds={p.scrollSeconds}
        showTabs={p.showTabs}
        instagramUrl={p.instagramUrl}
        xUrl={p.xUrl}
        youtubeUrl={p.youtubeUrl}
        posts={p.posts}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ padTop: 64, padBottom: 64 }),
        ...defaults,
      },
    },
  )
}
