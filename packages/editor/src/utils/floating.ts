/** Rect of the native selection, falling back to the innermost element when the root itself is selected. */
export function getDOMRangeRect(nativeSelection: Selection, rootElement: HTMLElement): DOMRect {
  const domRange = nativeSelection.getRangeAt(0)
  if (nativeSelection.anchorNode === rootElement) {
    let inner = rootElement
    while (inner.firstElementChild != null) inner = inner.firstElementChild as HTMLElement
    return inner.getBoundingClientRect()
  }
  return domRange.getBoundingClientRect()
}

/** Positions a floating element under `target`, flipping above when it would overflow the anchor. */
export function setFloatingElemPosition(
  target: DOMRect,
  floating: HTMLElement,
  anchor: DOMRect,
  verticalGap = 8,
  horizontalOffset = 0,
): void {
  const top = target.top - anchor.top + target.height + verticalGap
  const maxLeft = Math.max(0, anchor.width - floating.offsetWidth)
  const left = Math.min(Math.max(0, target.left - anchor.left + horizontalOffset), maxLeft)
  floating.style.left = `${left}px`
  floating.style.top =
    top + floating.offsetHeight > anchor.height
      ? `${target.top - anchor.top - floating.offsetHeight - verticalGap}px`
      : `${top}px`
}

export function hideFloatingElem(floating: HTMLElement): void {
  floating.style.top = '-10000px'
  floating.style.left = '-10000px'
}
