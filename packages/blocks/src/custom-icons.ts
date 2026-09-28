/**
 * Stroke icons for the Icon element, drawn for this project on a 24 grid with
 * `currentColor` (so they follow the theme's text colour). Kept small on
 * purpose: storefronts load none of them unless an Icon element uses one.
 */
export const CUSTOM_ICONS = {
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  heart: 'M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z',
  check: 'M4.5 12.5l4.5 4.5 10.5-10.5',
  truck:
    'M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.2v2.8h-7zM6.5 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01',
  shield: 'M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z',
  gift: 'M3.5 8.5h17v4h-17zM5 12.5h14v8H5zM12 8.5v12M12 8.5S10.5 4 8 4.5 7 8.5 12 8.5zm0 0s1.5-4.5 4-4 1 4-4 4z',
  leaf: 'M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l7-7',
  sparkle:
    'M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  phone:
    'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  mail: 'M3.5 6h17v12h-17zM3.5 6.5 12 13l8.5-6.5',
  pin: 'M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  tag: 'M3.5 12.2V4h8.2l8.8 8.8-8.2 8.2zM8 8.5a.5.5 0 1 0 0-.01',
  lock: 'M6 10.5h12v10H6zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3',
  return: 'M8 5 4 9l4 4M4 9h10a6 6 0 0 1 0 12h-3',
  arrow: 'M4 12h15M13 6l6 6-6 6',
} as const

export type CustomIconName = keyof typeof CUSTOM_ICONS

export const CUSTOM_ICON_NAMES = Object.keys(CUSTOM_ICONS) as CustomIconName[]
