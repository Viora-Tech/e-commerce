/**
 * Copy for the notice shown while the server processes images or runs an import in the
 * background (Home, Content → Files, the Shopify importer). `count` arrives formatted.
 */
export const backgroundWorkContent = {
  images: (count: string) => `Processing ${count} images in the background`,
  importing: 'An import is running in the background',
  slower: 'Your store may be a little slower until it finishes.',
  slowerFor: (minutes: number) =>
    `Your store may be a little slower until it finishes (about ${minutes} min).`,
  importingToo: 'An import is running too.',
}
