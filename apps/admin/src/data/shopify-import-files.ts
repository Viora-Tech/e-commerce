const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

/** The Files step's counts and weight, on the preview and the finished import. */
export const shopifyImportFilesContent = {
  heading: 'Files to copy',
  line: (images: number, videos: number, size: string) =>
    `${plural(images, 'picture', 'pictures')} · ${plural(videos, 'video', 'videos')}, about ${size} after optimizing`,
  unused: (n: number, size: string) =>
    `${plural(n, 'file', 'files')} (about ${size}) nothing uses stay in Shopify. Tick “Also import unused files” on the previous step to copy them.`,
  unusedIncluded: 'Unused files are included.',
  note: 'Videos used only by your theme are copied when you import the theme.',
} as const
