'use client'

import type { ChatwootIdentity, ChatwootWidget as Widget } from '@commerce/plugin-chatwoot/widget'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { useEffect } from 'react'
import { trackingAllowedOn } from '@/lib/tracking-paths'

type ChatwootWidgetProps = {
  widget: Widget
  /** The signed-in shopper, signed on the server; null for a guest. */
  identity: ChatwootIdentity | null
  /** The request's script CSP nonce: the SDK is an external script added by React. */
  nonce?: string | undefined
}

type ChatwootApi = {
  hasLoaded?: boolean
  setUser(identifier: string, user: Record<string, string>): void
  setCustomAttributes(attributes: Record<string, string | number>): void
  reset(): void
}

declare global {
  interface Window {
    chatwootSDK?: { run(config: { websiteToken: string; baseUrl: string }): void }
    $chatwoot?: ChatwootApi
    chatwootSettings?: Record<string, unknown>
  }
}

/** Who the widget was last told about in this browser, so signing out also ends their chat. */
const SEEN_KEY = 'commerce:chatwoot-user'

function remembered(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function remember(identifier: string | null): void {
  try {
    if (identifier) window.localStorage.setItem(SEEN_KEY, identifier)
    else window.localStorage.removeItem(SEEN_KEY)
  } catch {
    // Storage blocked: the chat still works, it just is not reset on sign-out.
  }
}

/** Tell the widget who is chatting: the signed-in shopper, or nobody after a sign-out. */
function identify(chat: ChatwootApi, identity: ChatwootIdentity | null): void {
  if (identity) {
    chat.setUser(identity.identifier, {
      identifier_hash: identity.identifierHash,
      ...(identity.name ? { name: identity.name } : {}),
      ...(identity.email ? { email: identity.email } : {}),
      ...(identity.phone ? { phone_number: identity.phone } : {}),
    })
    chat.setCustomAttributes(identity.attributes)
    remember(identity.identifier)
    return
  }
  if (remembered()) {
    chat.reset()
    remember(null)
  }
}

/**
 * The store's Chatwoot chat (https://www.chatwoot.com, MIT): Chatwoot's own website SDK from the
 * store's Chatwoot (`<baseUrl>/packs/js/sdk.js`), started with the inbox's website token. Rendered
 * by the consent manager once the store's chosen cookie category allows it, on block themes and
 * imported Liquid themes alike, never on sign-in pages (`trackingAllowedOn`), whose URLs carry
 * single-use tokens. `lazyOnload`: the chat waits until the page has finished loading.
 */
export default function ChatwootWidget({ widget, identity, nonce }: ChatwootWidgetProps) {
  // Hooks
  const pathname = usePathname()

  useEffect(() => {
    const handleReady = () => {
      if (window.$chatwoot) identify(window.$chatwoot, identity)
    }
    if (window.$chatwoot?.hasLoaded) handleReady()
    window.addEventListener('chatwoot:ready', handleReady)
    return () => window.removeEventListener('chatwoot:ready', handleReady)
  }, [identity])

  // Event handlers
  const handleLoad = () => {
    // Once per page: a remount (client navigation) finds the widget already running.
    if (window.$chatwoot || !window.chatwootSDK) return
    window.chatwootSettings = { position: 'right', type: 'standard', ...window.chatwootSettings }
    window.chatwootSDK.run({ websiteToken: widget.websiteToken, baseUrl: widget.baseUrl })
  }

  // Early returns
  if (!trackingAllowedOn(pathname)) return null

  // Render logic
  return (
    <Script
      id="chatwoot-sdk"
      src={`${widget.baseUrl}/packs/js/sdk.js`}
      strategy="lazyOnload"
      nonce={nonce}
      onReady={handleLoad}
    />
  )
}
