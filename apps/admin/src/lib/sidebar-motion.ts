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

/** The expanded rail's width (admin-frame.tsx sets `--sidebar-width` from it). */
export const SIDEBAR_WIDTH = '16rem'

/** The collapsed (icon) rail's width: shadcn's `--sidebar-width-icon`. */
export const SIDEBAR_WIDTH_ICON = '3rem'

/**
 * For a fixed panel portalled to <body> (a bottom drawer): starts where the content panel starts,
 * beside the rail, expanded or collapsed, instead of covering it. The rail's CSS variables live
 * on the sidebar wrapper, out of the portal's reach, so the widths are written out (the class has
 * to be literal for Tailwind) and `:has()` reads the rail's state, as the save bar rules do.
 * Phones have no rail on screen (it is a sheet there), so the panel stays full width.
 */
export const BESIDE_SIDEBAR =
  'md:[body:has([data-slot=sidebar][data-state=expanded])_&]:left-[16rem] md:[body:has([data-slot=sidebar][data-state=collapsed])_&]:left-[3rem]'
