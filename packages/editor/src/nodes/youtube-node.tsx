'use client'

import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical'
import { $applyNodeReplacement, DecoratorNode } from 'lexical'
import type { JSX } from 'react'
import { useState } from 'react'

export type SerializedYouTubeNode = Spread<
  { type: 'youtube'; videoID: string },
  SerializedLexicalNode
>

const SAFE_ID = /^[a-zA-Z0-9_-]+$/

/** Click-to-load facade: a thumbnail until played, so embeds do not slow typing. */
function YouTubeComponent({ videoID }: { videoID: string }) {
  // Hooks
  const [active, setActive] = useState(false)

  // Early returns
  if (!SAFE_ID.test(videoID)) return null
  if (!active) {
    return (
      <div className="editor-youtube editor-youtube--facade">
        <img
          src={`https://i.ytimg.com/vi/${videoID}/hqdefault.jpg`}
          alt="YouTube video thumbnail"
          loading="lazy"
        />
        <button
          type="button"
          className="editor-youtube__play"
          aria-label="Play video"
          onClick={() => setActive(true)}
        >
          ▶
        </button>
      </div>
    )
  }

  return (
    <div className="editor-youtube">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoID}?autoplay=1`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  )
}

function $convertYouTubeElement(domNode: HTMLElement): DOMConversionOutput | null {
  const videoID = domNode.getAttribute('data-lexical-youtube')
  return videoID ? { node: $createYouTubeNode(videoID) } : null
}

export class YouTubeNode extends DecoratorNode<JSX.Element> {
  __id: string

  static getType(): string {
    return 'youtube'
  }

  static clone(node: YouTubeNode): YouTubeNode {
    return new YouTubeNode(node.__id, node.__key)
  }

  static importJSON(serializedNode: SerializedYouTubeNode): YouTubeNode {
    return $createYouTubeNode(serializedNode.videoID)
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) =>
        domNode.hasAttribute('data-lexical-youtube')
          ? { conversion: $convertYouTubeElement, priority: 1 }
          : null,
    }
  }

  constructor(id: string, key?: NodeKey) {
    super(key)
    this.__id = id
  }

  exportJSON(): SerializedYouTubeNode {
    return { type: 'youtube', version: 1, videoID: this.__id }
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div')
    const safeId = SAFE_ID.test(this.__id) ? this.__id : ''
    element.setAttribute('data-lexical-youtube', safeId)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('src', safeId ? `https://www.youtube-nocookie.com/embed/${safeId}` : '')
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('title', 'YouTube video')
    element.appendChild(iframe)
    return { element }
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'editor-youtube-wrap'
    return div
  }

  updateDOM(): boolean {
    return false
  }

  getVideoID(): string {
    return this.__id
  }

  getTextContent(): string {
    return `https://www.youtube.com/watch?v=${this.__id}`
  }

  isInline(): false {
    return false
  }

  isKeyboardSelectable(): boolean {
    return true
  }

  decorate(): JSX.Element {
    return <YouTubeComponent videoID={this.__id} />
  }
}

export function $createYouTubeNode(videoID: string): YouTubeNode {
  return $applyNodeReplacement(new YouTubeNode(videoID))
}

export function $isYouTubeNode(node: LexicalNode | null | undefined): node is YouTubeNode {
  return node instanceof YouTubeNode
}
