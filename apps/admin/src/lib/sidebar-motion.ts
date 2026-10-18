/**
 * Class strings for the rail's collapse and expand motion (docs/conventions.md, "Motion").
 * `--sidebar-ms` is set once on the provider (admin-frame.tsx): 220ms, or 0 for the keyboard
 * shortcut and `prefers-reduced-motion`. Labels fade out first and back in a beat after the
 * rail has widened; icons never change position relative to the rail's left edge.
 */
export const SIDEBAR_DURATION = 'duration-(--sidebar-ms) ease-drawer'

/** Text beside an icon: stays on one line, fades instead of vanishing. */
export const SIDEBAR_LABEL =
  'whitespace-nowrap transition-opacity duration-150 delay-75 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0 group-data-[collapsible=icon]:duration-100 in-data-[sidebar-instant]:transition-none motion-reduce:transition-none'

/** A focusable control that fades with the labels and leaves the tab order once faded. */
export const SIDEBAR_CONTROL =
  'transition-[opacity,visibility] duration-150 delay-75 ease-out group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0 group-data-[collapsible=icon]:duration-100 in-data-[sidebar-instant]:transition-none motion-reduce:transition-none'

/** Pointer-transparent block that fades and gives its height back (domain pill, usage card). */
export const SIDEBAR_BLOCK =
  'overflow-hidden transition-[opacity,height,margin,visibility] duration-150 delay-75 ease-out group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:-mt-0.5 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0 group-data-[collapsible=icon]:duration-100 in-data-[sidebar-instant]:transition-none motion-reduce:transition-none'
