'use client'

import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  RangeSelection,
  SerializedElementNode,
  Spread,
} from 'lexical'
import { $applyNodeReplacement, $createParagraphNode, $isElementNode, ElementNode } from 'lexical'

export type SerializedCollapsibleContainerNode = Spread<
  { open: boolean; type: 'collapsible-container' },
  SerializedElementNode
>
export type SerializedCollapsibleTitleNode = Spread<
  { type: 'collapsible-title' },
  SerializedElementNode
>
export type SerializedCollapsibleContentNode = Spread<
  { type: 'collapsible-content' },
  SerializedElementNode
>

/** <details>: a title (summary) followed by content. */
export class CollapsibleContainerNode extends ElementNode {
  __open: boolean

  static getType(): string {
    return 'collapsible-container'
  }

  static clone(node: CollapsibleContainerNode): CollapsibleContainerNode {
    return new CollapsibleContainerNode(node.__open, node.__key)
  }

  static importJSON(serializedNode: SerializedCollapsibleContainerNode): CollapsibleContainerNode {
    return $createCollapsibleContainerNode(serializedNode.open)
  }

  static importDOM(): DOMConversionMap | null {
    return {
      details: () => ({
        conversion: (domNode: HTMLElement): DOMConversionOutput => ({
          node: $createCollapsibleContainerNode(domNode.hasAttribute('open')),
        }),
        priority: 1,
      }),
    }
  }

  constructor(open: boolean, key?: NodeKey) {
    super(key)
    this.__open = open
  }

  exportJSON(): SerializedCollapsibleContainerNode {
    return { ...super.exportJSON(), open: this.__open, type: 'collapsible-container' }
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('details')
    element.classList.add('collapsible-container')
    if (this.__open) element.setAttribute('open', '')
    return { element }
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('details')
    dom.classList.add('editor-collapsible')
    if (this.__open) dom.setAttribute('open', '')
    return dom
  }

  updateDOM(prevNode: CollapsibleContainerNode, dom: HTMLDetailsElement): boolean {
    if (prevNode.__open !== this.__open) {
      if (this.__open) dom.setAttribute('open', '')
      else dom.removeAttribute('open')
    }
    return false
  }

  getOpen(): boolean {
    return this.getLatest().__open
  }

  setOpen(open: boolean): void {
    this.getWritable().__open = open
  }

  toggleOpen(): void {
    this.setOpen(!this.getOpen())
  }

  isShadowRoot(): boolean {
    return true
  }
}

export class CollapsibleTitleNode extends ElementNode {
  static getType(): string {
    return 'collapsible-title'
  }

  static clone(node: CollapsibleTitleNode): CollapsibleTitleNode {
    return new CollapsibleTitleNode(node.__key)
  }

  static importJSON(): CollapsibleTitleNode {
    return $createCollapsibleTitleNode()
  }

  static importDOM(): DOMConversionMap | null {
    return {
      summary: () => ({ conversion: () => ({ node: $createCollapsibleTitleNode() }), priority: 1 }),
    }
  }

  exportJSON(): SerializedCollapsibleTitleNode {
    return { ...super.exportJSON(), type: 'collapsible-title' }
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('summary')
    element.classList.add('collapsible-title')
    return { element }
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('summary')
    dom.classList.add('editor-collapsible__title')
    return dom
  }

  updateDOM(): boolean {
    return false
  }

  /** Enter in the title moves the caret into the content. */
  insertNewAfter(_selection: RangeSelection, restoreSelection?: boolean): ElementNode {
    const container = this.getParentOrThrow()
    if (!$isElementNode(container))
      throw new Error('CollapsibleTitleNode expects a container parent')
    const content = container.getChildAtIndex(1)
    const paragraph = $createParagraphNode()
    if ($isElementNode(content)) content.append(paragraph)
    else container.insertAfter(paragraph, restoreSelection)
    return paragraph
  }

  collapseAtStart(): true {
    return true
  }
}

export class CollapsibleContentNode extends ElementNode {
  static getType(): string {
    return 'collapsible-content'
  }

  static clone(node: CollapsibleContentNode): CollapsibleContentNode {
    return new CollapsibleContentNode(node.__key)
  }

  static importJSON(): CollapsibleContentNode {
    return $createCollapsibleContentNode()
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) =>
        domNode.hasAttribute('data-lexical-collapsible-content')
          ? { conversion: () => ({ node: $createCollapsibleContentNode() }), priority: 2 }
          : null,
    }
  }

  exportJSON(): SerializedCollapsibleContentNode {
    return { ...super.exportJSON(), type: 'collapsible-content' }
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div')
    element.classList.add('collapsible-content')
    element.setAttribute('data-lexical-collapsible-content', 'true')
    return { element }
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('div')
    dom.classList.add('editor-collapsible__content')
    return dom
  }

  updateDOM(): boolean {
    return false
  }

  isShadowRoot(): boolean {
    return true
  }
}

export function $createCollapsibleContainerNode(isOpen: boolean): CollapsibleContainerNode {
  return $applyNodeReplacement(new CollapsibleContainerNode(isOpen))
}
export function $createCollapsibleTitleNode(): CollapsibleTitleNode {
  return $applyNodeReplacement(new CollapsibleTitleNode())
}
export function $createCollapsibleContentNode(): CollapsibleContentNode {
  return $applyNodeReplacement(new CollapsibleContentNode())
}
export function $isCollapsibleContainerNode(
  node: LexicalNode | null | undefined,
): node is CollapsibleContainerNode {
  return node instanceof CollapsibleContainerNode
}
export function $isCollapsibleTitleNode(
  node: LexicalNode | null | undefined,
): node is CollapsibleTitleNode {
  return node instanceof CollapsibleTitleNode
}
export function $isCollapsibleContentNode(
  node: LexicalNode | null | undefined,
): node is CollapsibleContentNode {
  return node instanceof CollapsibleContentNode
}
