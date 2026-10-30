# Tab titles and Shopify importer connection (30 Oct 2026)

Found re-testing the admin audit fixes (PR #987).

- Automation editor tab shows the automation's name; app pages show the app name, plus the
  page's tab label after the first page (`apps/[pluginId]/[[...path]]` `generateMetadata`).
- Shopify importer "Edit connection" opens the connect form over the saved connection
  (`/apps/shopify-import/connect?edit=1`, Cancel goes back); the Connection card has a Change
  button. Connecting again replaces the saved connection.
- The importer's connect tabs fit their text and are taller (local classes; shared tabs unchanged).
