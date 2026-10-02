import type { ImportStatus, ReportReason, SwapKey } from '@commerce/core/theme-import'

/** Copy for importing a Shopify theme: the upload dialog and the import report. */
export const themeImportContent = {
  button: 'Import Shopify theme',
  badge: 'Imported',
  reportLink: 'Import report',
  dialog: {
    title: 'Import your Shopify theme',
    body: 'Your theme comes over as a new theme here. It looks the same, and it runs on our cart, checkout, search and accounts. Your live theme does not change.',
    licenceTitle: 'Only upload a theme you own',
    licence:
      'Only upload themes you own or have the rights to. Themes bought from Shopify’s Theme Store are usually licensed for Shopify only.',
    licenceConfirm: 'I own this theme, or I have the rights to use it here',
    howTo:
      'In Shopify, open Online Store, then Themes. Click the three dots next to your theme and choose Download theme file. Shopify emails you a zip file. Upload that zip here.',
    file: 'Theme zip file',
    fileHint: 'The .zip file from Shopify, up to 50 MB',
    choose: 'Choose zip file',
    change: 'Choose a different file',
    host: 'Your Shopify store address (optional)',
    hostHint:
      'For example waimers.in or yourstore.myshopify.com. We copy your theme’s pictures from it into Files. Leave it empty to skip the pictures.',
    hostPlaceholder: 'yourstore.myshopify.com',
    cancel: 'Cancel',
    confirm: 'Import theme',
    importing: 'Importing your theme. This can take a minute…',
    done: (name: string) => `${name} is ready. Here is what we did with each part.`,
    failed: 'We could not import this theme. Check the file and try again.',
    tooLarge: 'This file is larger than 50 MB. Upload only the theme zip.',
    notZip: 'Choose the .zip file Shopify emailed you.',
  },
  editor: {
    settingsTitle: 'Colours, fonts and layout come from your Shopify theme',
    settingsBody:
      'Our theme presets do not apply to an imported theme. Change its sections on the left; editing its own theme settings here comes next.',
    report: 'See the import report',
  },
  report: {
    title: 'Import report',
    back: 'Themes',
    subtitle: (theme: string, file: string) => `${theme}, imported from ${file}`,
    customize: 'Customize theme',
    preview: 'Preview',
    intro:
      'Your theme keeps its look. Everything a shopper does (adding to cart, paying, searching, signing in) runs on this store’s own features. Here is each part of your theme and what happens to it.',
    onPages: 'On your home page, header and footer',
    wholeTheme: 'All sections in the theme',
    status: {
      imported: { label: 'Imported exactly', help: 'Looks and works the same.' },
      replaced: { label: 'Runs on our features', help: 'Same look; what it does runs here.' },
      unavailable: {
        label: 'Not available yet',
        help: 'The look is kept; one part has no match here yet.',
      },
      unsupported: {
        label: 'Could not import',
        help: 'Its code uses something we cannot read yet.',
      },
    } satisfies Record<ImportStatus, { label: string; help: string }>,
    sectionsHeading: 'Sections',
    sectionsBody: 'Sections on your imported pages come first.',
    columns: { section: 'Section', status: 'Result', why: 'What runs it now', usedIn: 'Used on' },
    usedIn: { home: 'Home', header: 'Header', footer: 'Footer' } as Record<string, string>,
    notPlaced: 'Not on a page yet',
    exact: 'Your theme’s own code',
    reasons: {
      cart_add: 'Add to cart puts the item in our cart',
      cart_drawer: 'The cart drawer opens our cart page',
      checkout: 'Checkout is ours (payments, COD, GST)',
      predictive_search: 'Search opens our search page',
      customer_accounts: 'Sign in and accounts are ours',
      newsletter: 'Signups join your subscriber list',
      contact: 'The contact form cannot send yet',
      app_blocks: 'Shopify app blocks are left out',
      metafields: 'Metafields show blank until you add matching fields',
      fonts: 'Fonts load from Google Fonts',
      hosted_images: 'Pictures copied into Files',
      payment_icons: 'Simple payment marks',
      localization: 'India and rupees only',
      recommendations: 'Recommendations are empty for now',
      preorder: 'Pre-order uses our built-in pre-order',
      app_data: 'Reads data from a Shopify app (such as Judge.me), so it stays hidden for now',
      main_template: 'This page uses our own page, with your header and footer',
      parse_error: 'Its code uses something we cannot read yet',
    } satisfies Record<ReportReason, string>,
    swapsHeading: 'What Shopify used, and what runs here instead',
    swapColumns: { shopify: 'On Shopify', ours: 'Here' },
    swaps: {
      cart_add: {
        shopify: 'Add to cart buttons',
        ours: 'Our cart. The shopper lands on the cart page.',
      },
      cart_drawer: { shopify: 'Cart drawer', ours: 'Our cart page. The drawer keeps its look.' },
      checkout: {
        shopify: 'Shopify checkout',
        ours: 'Our checkout with your payment methods, COD rules and GST invoices.',
      },
      predictive_search: {
        shopify: 'Instant search suggestions',
        ours: 'Our search page. The search box keeps its look.',
      },
      customer_accounts: {
        shopify: 'Customer accounts',
        ours: 'Our account pages, with sign in by one-time code.',
      },
      newsletter: {
        shopify: 'Newsletter signup',
        ours: 'Your subscriber list, with a confirm email.',
      },
      contact: {
        shopify: 'Contact form',
        ours: 'Not available yet. Show your email or WhatsApp number instead.',
      },
      app_blocks: {
        shopify: 'Shopify apps (Judge.me, Klaviyo…)',
        ours: 'Our apps where one exists (Reviews, Back in stock, EMI).',
      },
      metafields: {
        shopify: 'Metafields and metaobjects',
        ours: 'Blank until you add matching extra fields or content types.',
      },
      fonts: { shopify: 'Shopify fonts', ours: 'The same fonts from Google Fonts.' },
      hosted_images: { shopify: 'Pictures in Shopify Files', ours: 'Copied into your Files.' },
      payment_icons: { shopify: 'Payment icons', ours: 'Simple marks for your payment methods.' },
      localization: {
        shopify: 'Country and currency picker',
        ours: 'India and rupees only for now.',
      },
      recommendations: {
        shopify: 'Product recommendations',
        ours: 'Empty for now. Our Related products section can take its place.',
      },
      preorder: { shopify: 'Pre-order apps', ours: 'Our built-in pre-order.' },
      app_data: {
        shopify: 'Data from Shopify apps (Judge.me reviews…)',
        ours: 'Not available yet. The section stays hidden until our Reviews app has reviews.',
      },
    } satisfies Record<SwapKey, { shopify: string; ours: string }>,
    pagesHeading: 'Pages',
    pagesBody:
      'Your home page uses your theme’s sections. Other pages use our pages, inside your theme’s header and footer.',
    pages: { imported: 'Your theme’s sections', ours: 'Our page, your header and footer' },
    pageNames: {
      index: 'Home page',
      product: 'Product pages',
      collection: 'Collection pages',
      'list-collections': 'All collections',
      page: 'Pages',
      blog: 'Blog',
      article: 'Blog posts',
      cart: 'Cart',
      search: 'Search',
      '404': 'Page not found',
      password: 'Password page',
      gift_card: 'Gift card',
    } as Record<string, string>,
    todoHeading: 'Before you publish',
    todoNone: 'Nothing to do. Your theme has everything it needs.',
    missing: {
      menus: (list: string) =>
        `Add these menus in Content, then Menus (or import them with the Shopify importer): ${list}`,
      collections: (list: string) => `These collections are not in your store yet: ${list}`,
      products: (list: string) => `These products are not in your store yet: ${list}`,
      blogs: (list: string) => `These blogs are not in your store yet: ${list}`,
    },
    images: {
      copied: (n: number) =>
        n === 1 ? '1 picture copied into Files.' : `${n} pictures copied into Files.`,
      videosCopied: (n: number) =>
        n === 1 ? '1 video copied into Files.' : `${n} videos copied into Files.`,
      failed: (n: number) =>
        n === 1
          ? '1 picture could not be copied. Upload it in Files and pick it in Customize.'
          : `${n} pictures could not be copied. Upload them in Files and pick them in Customize.`,
      noHost: (n: number) =>
        `${n === 1 ? '1 picture was' : `${n} pictures were`} not copied because no Shopify store address was given. Import again with the address, or upload them in Files.`,
      videos: (n: number) =>
        `${n === 1 ? '1 video lives' : `${n} videos live`} in your Shopify Files and cannot be copied. Upload them in Files, then pick them in the slides that used them.`,
    },
    notFound: 'This theme was not imported from Shopify.',
  },
}
