/**
 * The theme editor's copy for an imported Shopify theme's apps and scripts: app blocks none of our
 * apps draws, the Shopify app embeds the theme was saved with, and the canvas that runs the
 * theme's own scripts on the store's own address.
 */
export const themeEditorAppsContent = {
  /** The canvas placeholder for an app block we have no app for. */
  missingBlock: (name: string) => `App block: ${name} (not available)`,
  /** Apps panel: the Shopify app embeds in the imported theme's settings. */
  importedEmbeds: 'From your Shopify theme',
  importedEmbedsNote:
    'App embeds the theme had on Shopify. They stay in the theme; the ones we have an app for are drawn by that app.',
  embedOurs: (app: string) => `Shown by ${app}`,
  embedMissing: 'Not available',
  embedOff: 'Off in the theme',
  /** The canvas switch that shows the page on the store's own address with its scripts running. */
  scripts: 'Theme scripts',
  scriptsOn: 'Show the page with the theme’s scripts running (sliders, tabs, accordions)',
  scriptsOff: 'Back to the editing canvas',
  scriptsNote:
    'Showing the page with its scripts. Click a section to edit it. Theme settings you have not saved show after Save.',
  scriptsFrame: 'Store page with theme scripts',
}
