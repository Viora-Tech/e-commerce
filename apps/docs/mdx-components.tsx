import type { MDXComponents } from 'mdx/types'
import { Steps, Tabs } from 'nextra/components'
import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'
import Callout from './components/callout'
import Faq from './components/faq'
import FaqItem from './components/faq-item'
import RelatedGuides from './components/related-guides'
import Screenshot from './components/screenshot'
import VideoTip from './components/video-tip'

const docsComponents = getDocsMDXComponents()

/* Registered here so every MDX page can use them without an import line. */
export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...docsComponents,
    Callout,
    Faq,
    FaqItem,
    Screenshot,
    VideoTip,
    RelatedGuides,
    Steps,
    Tabs,
    ...components,
  }
}
