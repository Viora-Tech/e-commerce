// Glide's icon set (snippets/icon.liquid). All use currentColor.
type Name =
  | 'search'
  | 'sun'
  | 'moon'
  | 'contrast'
  | 'cart'
  | 'user'
  | 'heart'
  | 'heart-filled'
  | 'arrow'
  | 'arrow-down'
  | 'chevron-down'
  | 'close'
  | 'menu'

const paths: Record<Name, { viewBox: string; body: string }> = {
  search: {
    viewBox: '0 0 17.5 17.5',
    body: '<path d="M16.75 16.75L12.9723 12.9656M15.0658 7.90789C15.0658 9.80629 14.3117 11.6269 12.9693 12.9693C11.6269 14.3117 9.80629 15.0658 7.90789 15.0658C6.0095 15.0658 4.18886 14.3117 2.8465 12.9693C1.50413 11.6269 0.75 9.80629 0.75 7.90789C0.75 6.0095 1.50413 4.18886 2.8465 2.8465C4.18886 1.50413 6.0095 0.75 7.90789 0.75C9.80629 0.75 11.6269 1.50413 12.9693 2.8465C14.3117 4.18886 15.0658 6.0095 15.0658 7.90789V7.90789Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  },
  sun: {
    viewBox: '0 0 24 24',
    body: '<circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.4v2.4M12 19.2v2.4M4.2 12H1.8M22.2 12h-2.4M6.5 6.5 4.8 4.8M19.2 19.2l-1.7-1.7M17.5 6.5l1.7-1.7M4.8 19.2l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
  moon: {
    viewBox: '0 0 24 24',
    body: '<path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  },
  contrast: {
    viewBox: '0 0 24 24',
    body: '<circle cx="12" cy="12" r="8.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8Z" fill="currentColor"/>',
  },
  cart: {
    viewBox: '0 0 32 32',
    body: '<path d="M3 5H7L10 22H26M10 16.6667H25.59C25.7056 16.6667 25.8177 16.6267 25.9072 16.5535C25.9966 16.4802 26.0579 16.3782 26.0806 16.2648L27.8806 7.26479C27.8951 7.19222 27.8934 7.11733 27.8755 7.04552C27.8575 6.97372 27.8239 6.90679 27.7769 6.84956C27.73 6.79234 27.6709 6.74625 27.604 6.71462C27.5371 6.68299 27.464 6.66662 27.39 6.66667H8M12 26C12 26.5523 11.5523 27 11 27C10.4477 27 10 26.5523 10 26C10 25.4477 10.4477 25 11 25C11.5523 25 12 25.4477 12 26ZM26 26C26 26.5523 25.5523 27 25 27C24.4477 27 24 26.5523 24 26C24 25.4477 24.4477 25 25 25C25.5523 25 26 25.4477 26 26Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  user: {
    viewBox: '0 0 18.5 23.5',
    body: '<path d="M17.75 22.75V20.0833C17.75 18.6688 17.2724 17.3123 16.4222 16.3121C15.5721 15.3119 14.419 14.75 13.2167 14.75H5.28333C4.08102 14.75 2.92795 15.3119 2.07778 16.3121C1.22762 17.3123 0.75 18.6688 0.75 20.0833V22.75M14.75 5.25C14.75 7.73528 12.7353 9.75 10.25 9.75C7.76472 9.75 5.75 7.73528 5.75 5.25C5.75 2.76472 7.76472 0.75 10.25 0.75C12.7353 0.75 14.75 2.76472 14.75 5.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  heart: {
    viewBox: '0 0 21.5 19.3335',
    body: '<path d="M5.75 0.75C2.989 0.75 0.75 2.966 0.75 5.7C0.75 7.907 1.625 13.145 10.238 18.44C10.3923 18.5339 10.5694 18.5835 10.75 18.5835C10.9306 18.5835 11.1077 18.5339 11.262 18.44C19.875 13.145 20.75 7.907 20.75 5.7C20.75 2.966 18.511 0.75 15.75 0.75C12.989 0.75 10.75 3.75 10.75 3.75C10.75 3.75 8.511 0.75 5.75 0.75Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  'heart-filled': {
    viewBox: '0 0 25.9071 22.7376',
    body: '<path d="M2.88778 12.7679L12.2689 21.5804C12.5933 21.8852 12.7555 22.0376 12.9536 22.0376C13.1516 22.0376 13.3138 21.8852 13.6382 21.5804L23.0193 12.7679C25.6276 10.3177 25.9443 6.28574 23.7506 3.45836L23.3382 2.92673C20.7139 -0.455622 15.4464 0.111625 13.6024 3.97514C13.342 4.52088 12.5651 4.52088 12.3047 3.97514C10.4607 0.111625 5.19318 -0.455621 2.56895 2.92673L2.15647 3.45836C-0.0371829 6.28574 0.279549 10.3177 2.88778 12.7679Z" fill="currentColor"/>',
  },
  arrow: {
    viewBox: '0 0 12.6649 23.3084',
    body: '<g transform="translate(12.6649,0) scale(-1,1)"><path d="M11.6658 23.3084C11.4004 23.3096 11.1456 23.2039 10.9591 23.0151L0.292453 12.3484C-0.0974845 11.958 -0.0974845 11.3255 0.292453 10.9351L10.9591 0.26839C11.3531 -0.0987553 11.9671 -0.087922 12.3479 0.292894C12.7288 0.67371 12.7396 1.28771 12.3725 1.68172L2.41245 11.6417L12.3725 21.6017C12.7624 21.9921 12.7624 22.6246 12.3725 23.0151C12.1859 23.2039 11.9312 23.3096 11.6658 23.3084Z" fill="currentColor"/></g>',
  },
  'arrow-down': {
    viewBox: '0 0 24 24',
    body: '<path d="M6.4 9L12 14.6L17.6 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  'chevron-down': {
    viewBox: '0 0 24 24',
    body: '<path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  close: {
    viewBox: '0 0 13 13',
    body: '<path d="M12.5 0.5L0.5 12.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M0.5 0.5L12.5 12.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  menu: {
    viewBox: '0 0 24 24',
    body: '<path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
}

export default function Icon({ name, size = 24 }: { name: Name; size?: number }) {
  const { viewBox, body } = paths[name]
  return (
    <svg
      className={`icon icon--${name}`}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static SVG path data from this file, no user input.
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}
