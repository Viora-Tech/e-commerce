'use client'

import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical'
import { $applyNodeReplacement, DecoratorNode } from 'lexical'
import type { JSX } from 'react'
import ImageComponent from '../ui/image-component'

export type ImageData = {
  src: string
  altText: string
  width?: number | undefined
  showCaption?: boolean | undefined
  key?: NodeKey | undefined
}

export type SerializedImageNode = Spread<
  { type: 'image'; src: string; altText: string; width: number | null; showCaption: boolean },
  SerializedLexicalNode
>

function $convertImageElement(domNode: Node): DOMConversionOutput | null {
  const img = domNode as HTMLImageElement
  if (!img.src || img.src.startsWith('file:///')) return null
  const width = img.width ? Number(img.width) : undefined
  return { node: $createImageNode({ src: img.src, altText: img.alt, width }) }
}

/** Block image with alt text, optional caption and an edit panel driven by the host's media hooks. */
export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string
  __altText: string
  __width: number | null
  __showCaption: boolean

  static getType(): string {
    return 'image'
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__width, node.__showCaption, node.__key)
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { src, altText, width, showCaption } = serializedNode
    return $createImageNode({ src, altText, width: width ?? undefined, showCaption })
  }

  static importDOM(): DOMConversionMap | null {
    return { img: () => ({ conversion: $convertImageElement, priority: 0 }) }
  }

  constructor(
    src: string,
    altText: string,
    width: number | null,
    showCaption: boolean,
    key?: NodeKey,
  ) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__width = width
    this.__showCaption = showCaption
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      showCaption: this.__showCaption,
    }
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img')
    element.setAttribute('src', this.__src)
    element.setAttribute('alt', this.__altText)
    if (this.__width) element.setAttribute('width', String(this.__width))
    return { element }
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div')
    const className = config.theme.image
    if (className !== undefined) div.className = className
    return div
  }

  updateDOM(): boolean {
    return false
  }

  getSrc(): string {
    return this.__src
  }

  getAltText(): string {
    return this.__altText
  }

  setImage(update: {
    src?: string | undefined
    altText?: string | undefined
    width?: number | undefined
    showCaption?: boolean | undefined
  }): void {
    const writable = this.getWritable()
    if (update.src !== undefined) writable.__src = update.src
    if (update.altText !== undefined) writable.__altText = update.altText
    if (update.width !== undefined) writable.__width = update.width
    if (update.showCaption !== undefined) writable.__showCaption = update.showCaption
  }

  isInline(): false {
    return false
  }

  isKeyboardSelectable(): boolean {
    return true
  }

  decorate(): JSX.Element {
    return (
      <ImageComponent
        nodeKey={this.getKey()}
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        showCaption={this.__showCaption}
      />
    )
  }
}

export function $createImageNode({ src, altText, width, showCaption, key }: ImageData): ImageNode {
  return $applyNodeReplacement(
    new ImageNode(src, altText, width ?? null, showCaption ?? false, key),
  )
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}
