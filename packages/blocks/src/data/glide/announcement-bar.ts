/**
 * Copy, defaults and field labels for the announcement bar (Zero Drift theme
 * `sections/announcement-bar.liquid`). Defaults are the theme's live
 * `sections/header-group.json` values.
 */
export const announcementBarContent = {
  label: 'Announcement bar',
  announcements: [
    {
      text: '<p>We have started International shipping for Many brands, please reach out on our discord for more details!</p>',
      link: '',
    },
    { text: '<p>3% Discount on all UPI ID Transactions.</p>', link: '' },
    { text: '<p>Free shipping on All orders except accessories</p>', link: '' },
    { text: '<p>Check our catalog of Premium Glasspads</p>', link: '/collections/glass-mousepads' },
    {
      text: '<p>Lofree Hyzen, Flow 2 and Flow Lite now available on preorder</p>',
      link: '/collections/lofree',
    },
  ],
  newAnnouncement: { text: '<p>Welcome to our store</p>', link: '' },
  scheme: 'scheme-4',
  displayMode: 'marquee',
  autorotate: true,
  /** Seconds each message shows in rotate mode (theme range 3-8). */
  autorotateSpeed: 5,
  /** Seconds one full pass of the marquee takes (theme range 20-60). */
  marqueeSpeed: 35,
  showSocial: true,
  previous: 'Previous announcement',
  next: 'Next announcement',
  region: 'Announcements',
  social: {
    instagram: 'Instagram',
    twitter: 'X (Twitter)',
    discord: 'Discord',
    youtube: 'YouTube',
  },
  fields: {
    announcements: 'Announcements',
    text: 'Text',
    link: 'Link',
    scheme: 'Colour scheme',
    displayMode: 'Display',
    autorotate: 'Rotate automatically (rotate mode)',
    autorotateSpeed: 'Seconds per message (rotate mode)',
    marqueeSpeed: 'Seconds per scroll (marquee mode)',
    showSocial: 'Social icons (desktop)',
    socials: 'Social links',
    platform: 'Network',
    url: 'Link',
    fallback: 'Announcement',
    socialFallback: 'Social link',
  },
  displayModes: [
    { label: 'Rotate one at a time', value: 'rotate' },
    { label: 'Scrolling marquee', value: 'marquee' },
  ],
  onOff: [
    { label: 'On', value: true },
    { label: 'Off', value: false },
  ],
  socialOptions: [
    { label: 'Instagram', value: 'instagram' },
    { label: 'X (Twitter)', value: 'twitter' },
    { label: 'Discord', value: 'discord' },
    { label: 'YouTube', value: 'youtube' },
  ],
} as const
