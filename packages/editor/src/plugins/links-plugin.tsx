'use client'

import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin'
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin'
import { LinkPlugin as LexicalLinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { validateUrl } from '../utils/url'

const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/

const EMAIL_MATCHER =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/

const MATCHERS = [
  (text: string) => {
    const match = URL_MATCHER.exec(text)
    if (match === null) return null
    const full = match[0]
    return {
      index: match.index,
      length: full.length,
      text: full,
      url: full.startsWith('http') ? full : `https://${full}`,
      attributes: { rel: 'noopener', target: '_blank' },
    }
  },
  (text: string) => {
    const match = EMAIL_MATCHER.exec(text)
    if (match === null) return null
    const full = match[0]
    return { index: match.index, length: full.length, text: full, url: `mailto:${full}` }
  },
]

/** Explicit links, auto-detected URLs/emails, and ctrl-click to open. */
export default function LinksPlugin() {
  return (
    <>
      <LexicalLinkPlugin validateUrl={validateUrl} />
      <AutoLinkPlugin matchers={MATCHERS} />
      <ClickableLinkPlugin />
    </>
  )
}
