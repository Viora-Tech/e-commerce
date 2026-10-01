# Zero Drift theme port: inventory and plan

Inventory of the Zero Drift Shopify theme (formerly Glide 2.0.0; its `settings_schema.json` still says Glide; Viora Tech, the owner's own theme, read-only at
`E:\Dev\Shopify\theme`) against our storefront blocks, plus the phased plan for porting it into Puck
sections. Written 2026-10-01 alongside phase 1. Nothing in the theme repo is edited.

## Phases

| Phase | Scope | State |
| --- | --- | --- |
| 1 | The 14 home-page sections not yet in our repo (ships-today through discord-cta). Files go in `packages/blocks/src/components/sections/glide/`. | Done (#221) |
| 2 | Rest of the home page, header and footer groups, the product page, and the UI-kit effects swapped to the originals (`packages/blocks/src/effects/`). | This PR |
| 3 | Collection, cart, search, account, blog/article/notes, guides, pages. | Proposed |
| 4 | Sections no template uses (see the end of this doc). Only if wanted. | Backlog |

Status legend (used in the tables):

| Status | Meaning |
| --- | --- |
| `identical` | We have a port or equivalent, the theme file has not changed since, and the settings we expose cover its purpose. Minor gaps are listed in the notes. |
| `changed since our port` | We have a port or a generic equivalent, but the theme file changed after our port or its settings and blocks are richer than our fields. A generic equivalent that was never a line-for-line Glide port is marked as such in the notes. |
| `missing` | Nothing equivalent in our repo (or only a different generic block). |
| `not needed` | Shopify-only, app-specific, a Section Rendering API helper, or the page already exists natively in our storefront. The notes say why. |
| `ported (phase 1)` | Ported in phase 1 (#221). |
| `ported (phase 2)` | Ported or refreshed in phase 2. |

Dates were compared with `git log -1 --format=%cs` on both repos. Our repo's dates come from a
rebased history, so treat a gap of a day or two as noise; the settings comparison decides.

## Section inventory (all 114 files in `sections/`)

"Used by" lists the `templates/*.json` (including `customers/`) and section groups that reference the
section by `"type"`. "(off)" means the entry is disabled in the template. "Key settings/blocks"
leaves out colour scheme and padding, which every section has.

| Section file | Purpose | Used by | Key settings / blocks | Our equivalent | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `announcement-bar.liquid` | Top strip of rotating or scrolling announcements with social links | header-group | show_social, display_mode, autorotate, autorotate_speed, marquee_speed; blocks: announcement | `sections/glide/announcement-bar.tsx` (AnnouncementBar, refreshed in place) | ported (phase 2) | Announcement blocks, autorotate, Magic UI Marquee mode, socials as section settings. Old `{text, link}` data still renders. |
| `apps.liquid` | Shopify app block host | page.reviews (off) | anchor; blocks: @app | - | not needed | Shopify-only. Our app blocks come from plugins (app-blocks.tsx). |
| `article-series.liquid` | Related posts from the same Notes series, under an article | article.notes | heading, series_tag | - | missing | Needed for notes articles (phase 3). |
| `banner-mosaic.liquid` | Tilted mosaic of collection images behind a banner message | none | tagline, heading, text, button_label, button_link +8 more; blocks: tile | - | missing | Not on any template; add in a later pass if wanted. |
| `banner-reveal.liquid` | Banner that reveals a product, collection or video on scroll | none | image, product, collection, video, reveal_style +8 more | - | missing | Not on any template. |
| `bento-categories.liquid` | Bento grid of collection tiles | none | heading; blocks: collection | `packages/blocks/src/components/sections/bento-grid.tsx` (BentoGrid) | missing | BentoGrid is a generic block, not a Glide port; no collection binding. |
| `blog-posts.liquid` | Latest posts from a blog as cards | none | heading, blog, post_count, show_image, show_date +3 more | `packages/blocks/src/blog-posts-block.tsx` (BlogPosts) | identical | Theme untouched since before our port. Ours lacks the show image/date/excerpt toggles and placeholders. |
| `brand-lab.liquid` | Brand wall of partner labs with logos and links | index | heading, intro, cta_label, cta_link; blocks: brand | `packages/blocks/src/components/sections/glide/brand-lab.tsx` | ported (phase 1) |  |
| `cart-drawer.liquid` | Slide-out cart with recommendations, UPI nudge, recently viewed, quick view | layout/theme.liquid | none (helper) | - | missing | Cart drawer CSS exists in section-cart.css; no drawer component. Phase 3 with the cart. |
| `category-panels.liquid` | Row of tall category panels with hover reveal | index | kicker, heading; blocks: panel | `packages/blocks/src/components/sections/glide/category-panels.tsx` | ported (phase 1) |  |
| `category-tiles.liquid` | Grid of collection tiles | none | heading, columns_desktop; blocks: collection | `packages/blocks/src/components/sections/collection-list.tsx` (CollectionList) | missing | CollectionList is our Dawn-style block, not a port of this section. |
| `collapsible-content.liquid` | FAQ-style disclosure rows | page.faq | heading, subheading, open_first, width; blocks: question | `packages/blocks/src/components/sections/faq.tsx` (Faq) | identical | Theme older than our port. Ours lacks subheading, open-first and width. |
| `compare-specs.liquid` | Spec data feed for the compare tray (Section Rendering API) | none | none (helper) | - | not needed | Helper fetched by JS, never placed. The compare tray itself is a feature to decide on. |
| `comparison-table.liquid` | Side-by-side product comparison table | none | kicker, heading, row_labels, metafield_rows, show_brand +2 more; blocks: product | - | missing |  |
| `complete-setup.liquid` | Pick products to build a complete setup, with bundle total | none | kicker, heading; blocks: product | - | missing |  |
| `concierge-form.liquid` | Help-me-choose request form on guide pages | page.find-your-match, page.guide-keyboard, page.guide-mouse, page.guide-pad | heading, intro, category_preset; blocks: category | - | missing | Needs a form-submission route. |
| `contact-form.liquid` | Contact page: form plus support details | page.contact | heading, intro, details_heading, response_time, support_hours +3 more | - | missing | Needs a form-submission route. |
| `cookie-banner.liquid` | Cookie consent bar | footer-group | position, message, policy_link, policy_label, accept_label +5 more | `components/sections/glide/cookie-banner.tsx` (CookieBanner, dynamic section) | ported (phase 2) | Look and labels live in the footer group; consent logic stays in the storefront ConsentManager. One banner only. |
| `countdown-timer.liquid` | Countdown to a date with call to action | none | kicker, heading, subtext, end_at, expired_text +2 more | - | missing | Pre-order launch timer is a planned core feature. |
| `custom-section.liquid` | Blank section holding any theme blocks | none | background_image; blocks: @theme | `packages/blocks/src/sections/custom-layout.tsx` (Group, Columns, Grid) | not needed | Covered by our Layout and Elements blocks. |
| `discord-cta.liquid` | Community call to action (Discord or other) with perks | index, page.about | platform, eyebrow, heading, text, button_label +5 more; blocks: perk | `packages/blocks/src/components/sections/glide/discord-cta.tsx` | ported (phase 1) |  |
| `drop-reveal.liquid` | Reveal strip for the newest drop collection, with ribbon | index | collection, show_ribbon, ribbon_label, product_count, heading +3 more | `packages/blocks/src/components/sections/glide/drop-reveal.tsx` | ported (phase 1) |  |
| `drops-teaser.liquid` | Teaser cards for upcoming drops with roadmap link | index | eyebrow, heading, roadmap_link, roadmap_label; blocks: drop | `packages/blocks/src/components/sections/glide/drops-teaser.tsx` | ported (phase 1) |  |
| `feature-scroller.liquid` | Pinned scroll panel swapping images and copy per step | none | heading, media_position, product, low_stock_threshold; blocks: entry | - | missing | Not on any template. |
| `featured-carousel.liquid` | Carousel of featured products, each a full buy box | index | eyebrow, heading, image_side, autoplay, autoplay_interval +6 more; blocks: slide | `packages/blocks/src/components/sections/glide/featured-carousel.tsx` | ported (phase 1) | Glide lazy-loads slides through featured-lockup-remote; we render directly. |
| `featured-lockup-remote.liquid` | One featured-carousel slide fetched on demand (Section Rendering API) | none | none (helper) | - | not needed | Shopify rendering helper; our React renders slides itself. |
| `featured-product.liquid` | One product, large image and buy box | index (off) | product, image_side, eyebrow, show_stamp, stamp_text +4 more | `components/sections/glide/featured-product.tsx` (FeaturedProduct, refreshed in place) | ported (phase 2) | Stamp, share and help link added; old saved props still render. |
| `featured-products.liquid` | Product grid from a collection | none | collection, kicker, heading, products_to_show, columns_desktop +1 more | `packages/blocks/src/puck-config.tsx` (FeaturedProducts) | changed since our port | Generic equivalent, not a Glide port. |
| `fit-explorer.liquid` | Dark panel to flip between sizes or shapes of a product line | none | heading, intro; blocks: option | - | missing | Not on any template. |
| `footer-group.json` | Footer section group: newsletter, footer, dock, cookie banner, popups | none | section group | `packages/core/src/theme/templates-data.ts` (footer group) | ported (phase 2) | Default group follows the theme: newsletter, footer, mobile dock, cookie banner, signup popups. |
| `footer.liquid` | Site footer: help cards, columns, socials, payment icons, policies, localisation | footer-group | columns, show_payment_icons, show_policies, show_localization; blocks: help_card (max 3), text, column, social | `components/footer.tsx` (Footer, dynamic, refreshed) | ported (phase 2) | Help cards, text, socials, payment icons, policies toggles. Old `{tagline}` still renders. |
| `guide-entry.liquid` | Guides hub entry cards | page.find-your-match | eyebrow, heading, text; blocks: guide | - | missing |  |
| `guide-essentials.liquid` | Key points block on a buying guide | page.guide-keyboard, page.guide-mouse, page.guide-pad | heading, intro; blocks: point | - | missing |  |
| `guide-fit.liquid` | Fit profile to recommended products | none | heading, intro; blocks: fit | - | missing | Not on any template. |
| `guide-quiz.liquid` | Interactive finder quiz filtering a collection | page.guide-keyboard, page.guide-mouse, page.guide-pad | collection, heading, intro, cta_label, reset_label +2 more; blocks: question | - | missing | Big: needs filtered collection query and results render. |
| `guide-ranking.liquid` | Ranked product list for a guide | page.guide-keyboard, page.guide-mouse, page.guide-pad | heading, layout, intro; blocks: entry | - | missing |  |
| `guide-results.liquid` | Quiz results render target (Section Rendering API) | none | none (helper) | - | not needed | Helper for guide-quiz; replaced by our own result component when the quiz is ported. |
| `guide-tiles.liquid` | Category tiles into guides | none | categories_heading; blocks: category | - | missing | Not on any template. |
| `hall-of-fame.liquid` | Showcase of notable customers or builds from a collection | page.hall-of-fame | collection, eyebrow, heading, body, intro_full_width | - | missing |  |
| `header-group.json` | Header section group: announcement bar and header | none | section group | `packages/core/src/theme/templates-data.ts` (header group) | ported (phase 2) | Default group: AnnouncementBar (theme announcements) + Header. |
| `header.liquid` | Site header: logo, mega menu, search overlay, wishlist, cart | header-group | menu, logo_position, sticky, show_wishlist, show_menu_images +7 more; blocks: feature_card | `components/header.tsx` (Header, dynamic, refreshed) | ported (phase 2) | Mega menu with images, search overlay with popular terms, brand pills, feature cards, sticky, wishlist link. The wishlist page is phase 3. |
| `hero-carousel.liquid` | Full-bleed hero carousel with image and video slides | index | frame, pin, autoplay, autoplay_interval, show_arrows +17 more; blocks: image_slide, video_slide | `sections/hero-block.tsx` + `components/hero-carousel.tsx` (Hero, refreshed in place) | ported (phase 2) | Image and video slides, dots, counter, scrim, pin, autoplay. Old slides still render. |
| `image-comparison.liquid` | Before/after image slider | index (off) | heading, image_before, image_after, product_before, product_before_image +8 more | `components/sections/glide/image-comparison.tsx` (ImageComparison) | ported (phase 2) | Keyboard-accessible range slider; optional product images. |
| `image-gallery.liquid` | Image grid or masonry with lightbox | page.about | heading, subheading, layout, columns, gap +1 more; blocks: image | `packages/blocks/src/components/sections/gallery.tsx` (Gallery) | changed since our port | Generic equivalent, not a Glide port. |
| `image-with-text.liquid` | Two columns: media and copy | page.about | image, media_side, image_fit, media_panel, heading +4 more | `packages/blocks/src/components/sections/image-with-text.tsx` (ImageWithText) | changed since our port | Glide adds media panel, image fit, button style. |
| `latest-drop.liquid` | Spotlight on the latest drop product with deadline and specs | index | product, kicker, blurb, deadline, cta_label +2 more; blocks: spec | `packages/blocks/src/components/sections/glide/latest-drop.tsx` | ported (phase 1) |  |
| `logo-carousel.liquid` | Scrolling logo or press strip | index | heading, display, press_grayscale, logo_height, scroll_speed +2 more; blocks: logo | `packages/blocks/src/components/sections/glide/logo-carousel.tsx` | ported (phase 1) | Generic LogoMarquee stays for other pages. |
| `main-404.liquid` | Not-found page with search and quick links | 404 | collection, message, button_label, button_link; blocks: quick_link | `packages/blocks/src/sections/dynamic.tsx` (MainNotFound) | changed since our port | Generic equivalent; no settings. Glide has collection and quick-link blocks. |
| `main-article-notes.liquid` | Article layout for the Notes series | article.notes | series_label, heading_font, body_font, show_date, show_author | - | missing | Needs the article.notes template (phase 3). |
| `main-article.liquid` | Blog article page | article | none (helper) | `packages/blocks/src/sections/dynamic.tsx` (MainArticle) | changed since our port | Generic equivalent; no settings. |
| `main-blog.liquid` | Blog index page | blog | none (helper) | `packages/blocks/src/sections/dynamic.tsx` (MainBlog) | changed since our port | Generic equivalent; no settings. |
| `main-cart.liquid` | Cart page: lines, UPI nudge, trust, recommendations | cart | upi_discount_note, show_trust, show_recommendations; blocks: text, note | `packages/blocks/src/sections/dynamic.tsx` (MainCart) | changed since our port | Generic equivalent; UPI nudge and recommendations missing. |
| `main-collection.liquid` | Collection page: filters, sort, grid, pagination | collection | show_description, products_per_page, columns_desktop, columns_mobile, show_rating +2 more | `packages/blocks/src/sections/dynamic.tsx` (MainCollection) | changed since our port | Generic equivalent. Glide adds columns, quick add, pagination style. |
| `main-customers-account.liquid` | Account home with orders | customers/account | orders_per_page, tracking_page, show_help, help_link | - | not needed | Native: apps/storefront account routes. Glide tracking and help links not carried over. |
| `main-customers-activate-account.liquid` | Activate account from email | customers/activate_account | heading, subtext | - | not needed | OTP sign-in, no passwords. |
| `main-customers-addresses.liquid` | Address book | customers/addresses | none (helper) | - | not needed | Native: account/addresses. |
| `main-customers-login.liquid` | Sign in form | customers/login | heading, subtext, show_register_link, show_guest_checkout | - | not needed | Native: account/login (OTP, social). |
| `main-customers-order.liquid` | Order detail with tracking | customers/order | show_tracking, show_shipment_items, show_help, help_link | - | not needed | Native: account/orders/[number]. |
| `main-customers-register.liquid` | Create account | customers/register | heading, subtext, show_marketing_opt_in | - | not needed | OTP sign-in creates the account. |
| `main-customers-reset-password.liquid` | Reset password | customers/reset_password | heading | - | not needed | OTP sign-in, no passwords. |
| `main-list-collections.liquid` | All collections, brands and drops lists | list-collections.brands, list-collections.drops, list-collections | show_collections, heading, columns_desktop, per_page | - | missing | Storefront has a collections route; no Puck section for it. |
| `main-page.liquid` | Generic page body | page, page.reviews | none (helper) | `packages/blocks/src/sections/dynamic.tsx` (MainPage) | changed since our port | Generic equivalent; show-title only. |
| `main-product.liquid` | Product page: gallery, buy box, accordions, EMI, delivery, WhatsApp ask | product | none (helper) | `components/product-view.tsx` + `product-*.tsx` (MainProduct, dynamic) | ported (phase 2) | Gallery with Aceternity Lens; buy-box blocks are section settings (promise blocks start off). Rating needs a reviews source; metafield-driven spec cells not ported. |
| `main-search.liquid` | Search results page | search | none (helper) | `packages/blocks/src/sections/dynamic.tsx` (MainSearch) | changed since our port | Generic equivalent; filters and sort switches. |
| `mobile-dock.liquid` | Mobile bottom navigation bar | footer-group | blocks: link | `components/sections/glide/mobile-dock.tsx` (MobileDock) | ported (phase 2) | Link blocks with icons. |
| `multicolumn.liquid` | Row of icon, image and text columns | none | heading, subheading, columns, alignment; blocks: column | `packages/blocks/src/components/sections/multicolumn.tsx` (Multicolumn) | changed since our port | Glide has alignment, column count and richer column blocks. |
| `newsletter.liquid` | Newsletter signup with interests and reasons | footer-group | eyebrow, heading, text, reassurance; blocks: interest (max 4), reason (max 4) | `components/sections/newsletter.tsx` (Newsletter, refreshed in place) | ported (phase 2) | Interests, reasons, reassurance; Aceternity Meteors on the card. |
| `notes-series.liquid` | Latest posts from the Notes series | index | eyebrow, heading, text, blog, series_tag +3 more | `packages/blocks/src/components/sections/glide/notes-series.tsx` | ported (phase 1) |  |
| `order-tracking.liquid` | Order tracking lookup page | page.tracking | heading, intro, orders_to_show, show_shipment_items, preorder_link +4 more; blocks: faq | - | missing |  |
| `overlay-banner.liquid` | Image or video banner with overlaid text | none | image, mobile_image, video_url, height, tint_opacity +10 more | `packages/blocks/src/components/sections/image-banner.tsx` (ImageBanner) | missing | ImageBanner is our Dawn-style block, not a port of this section. |
| `password.liquid` | Storefront password gate | password | none (helper) | - | not needed | Shopify storefront lock; a store-level feature if ever wanted. |
| `perfect-match.liquid` | Pick a category, see a matching product pair | index | heading, highlight_words, collection, cta_label, cta_link; blocks: slot (max 6), category | `packages/blocks/src/components/sections/glide/perfect-match.tsx` | ported (phase 1) |  |
| `preorder-updates.liquid` | Pre-order batch timeline page | page.preorder-updates | heading, intro; blocks: month, batch | - | missing |  |
| `product-bundle.liquid` | Bundle of products with savings text | none | kicker, heading, savings_text; blocks: product | - | missing |  |
| `product-features.liquid` | Alternating image and text rows from product metaobjects | none | none (helper) | `components/sections/glide/product-features.tsx` (ProductFeatures) | ported (phase 2) | Typed rows. |
| `product-reviews.liquid` | Product reviews app block host | none | heading; blocks: @app | `components/sections/glide/product-reviews.tsx` (ProductReviews) | ported (phase 2) | Placeholder: no reviews data source yet. |
| `product-size-guide.liquid` | Size guide from product tags and dimensions | product | heading, measure_label, measure_unit, dims_label, tags_label +2 more | `components/sections/glide/product-size-guide.tsx` (ProductSizeGuide) | ported (phase 2) | Rows can be connected to a product metafield. |
| `product-size-table.liquid` | Size table on product page | product | heading, show_units, note | `components/sections/glide/product-size-table.tsx` (ProductSizeTable) | ported (phase 2) | Rows can be connected to a product metafield; mm/cm/in switch. |
| `product-spec-strip.liquid` | Strip of key product specs | none | heading; blocks: spec | `components/sections/glide/product-spec-strip.tsx` (ProductSpecStrip) | ported (phase 2) | Up to 6 items. |
| `product-specs.liquid` | Product specification groups, accordion | product | heading, open_first | `components/sections/glide/product-specs.tsx` (ProductSpecs) | ported (phase 2) | Spec groups; rows can be connected to a multi-line metafield. |
| `product-spotlight.liquid` | One product told as a story, stats and image | none | product, image, image_side, eyebrow, heading +4 more | - | missing |  |
| `product-tabs.liquid` | Tabs under the product: description, add-ons, more | product | layout; blocks: _tab | `components/sections/glide/product-tabs.tsx` (ProductTabs) | ported (phase 2) | Description, text and spec tabs. Add-ons, recommendations and Judge.me tabs not ported. |
| `product.liquid` | Dawn stub product section | none | none (helper) | - | not needed | Unused leftover; main-product replaces it. |
| `promo-banners.liquid` | Row of promo banners | none | heading; blocks: banner | `packages/blocks/src/components/sections/cta-banner.tsx` (CtaBanner) | missing | CtaBanner is generic; different layout. |
| `promo-bento.liquid` | Promo bento tiles with text reveal | index | heading, subheading, text_reveal; blocks: tile | `packages/blocks/src/components/sections/glide/promo-bento.tsx` | ported (phase 1) |  |
| `promo-popup.liquid` | Timed or exit-intent promo popup | none | kicker, heading, text, show_social, image +6 more | - | missing |  |
| `quick-order-list.liquid` | Bulk order table from a collection | none | heading, collection, show_images, only_available | - | missing |  |
| `quick-view-card.liquid` | Quick view dialog content (Section Rendering API) | none | none (helper) | - | not needed | Helper; quick view is built natively when the cart drawer is ported. |
| `recently-viewed-card.liquid` | Recently viewed row content (Section Rendering API) | none | none (helper) | `packages/blocks/src/sections/dynamic.tsx` (RecentlyViewed) | not needed | Helper. Our RecentlyViewed section covers the feature. |
| `related-collections.liquid` | Related collections on a collection page | collection | heading; blocks: collection | - | missing | Collection page (phase 3). |
| `related-products.liquid` | Related products on a product page | product | heading, products_to_show, recommendation_intent | `components/product-recommendations.tsx` (RelatedProducts, refreshed) | ported (phase 2) | Theme look; recommendation intent needs a recommendations source. |
| `restock-alerts.liquid` | Back-in-stock alert signup by category | none | eyebrow, heading, text, button_label; blocks: category | - | missing | Back-in-stock API exists (apps/storefront/src/app/api/back-in-stock); no section. |
| `review-stack.liquid` | Stacked review cards with link | page.about | kicker, heading, link_label, link | - | missing |  |
| `reviews-showcase.liquid` | Auto-scrolling reviews wall with ratings and photos | index, page.reviews | eyebrow, heading, min_rating, max_reviews, speed +6 more | `packages/blocks/src/components/sections/glide/reviews-showcase.tsx` | ported (phase 1) |  |
| `reviews.liquid` | Reviews list with aggregate rating | index (off), page.reviews | kicker, heading, body_lines, aggregate_rating, aggregate_text +2 more; blocks: review, @app | `components/sections/glide/reviews.tsx` (Reviews) | ported (phase 2) | Merchant-typed reviews; no reviews data source. |
| `rich-text.liquid` | Heading, text, button with drop cap option | none | kicker, heading, drop_cap, body, width +4 more | `packages/blocks/src/puck-config.tsx` (RichText) | changed since our port | Generic equivalent; no kicker, drop cap, button. |
| `roadmap-timeline.liquid` | Roadmap timeline from entries | page.about, page.roadmap | heading, intro, source, disclaimer; blocks: entry | - | missing |  |
| `scrolling-text.liquid` | Scrolling text ticker | none | text, size, motion, direction, link | - | missing |  |
| `ships-today.liquid` | Ships-today cutoff countdown with items | index | cutoff_hour, tz_offset, collection; blocks: item | `packages/blocks/src/components/sections/glide/ships-today.tsx` | ported (phase 1) |  |
| `shop-by-spec.liquid` | Spec chips linking to filtered collections | none | heading, subheading; blocks: shortcut | - | missing |  |
| `shop-the-look.liquid` | Image with product hotspots | none | kicker, heading, image; blocks: hotspot | - | missing |  |
| `signup-popup.liquid` | Signup popup in 3 styles (corner, figure, feed) | footer-group | style, image, figure_image, figure_product, feed_products +19 more | `components/sections/glide/signup-popup.tsx` (SignupPopup) | ported (phase 2) | Corner, figure and feed styles; shown inline while editing. |
| `social-wall.liquid` | Social posts wall with tabs and autoscroll | index | layout, autoscroll, scroll_speed, heading, subheading +1 more; blocks: post | `packages/blocks/src/components/sections/glide/social-wall.tsx` | ported (phase 1) |  |
| `software-index.liquid` | Software downloads list from a collection | page.software | heading, intro, collection, empty_text, footnote | - | missing |  |
| `stat-counter.liquid` | Animated number stats | page.about | kicker; blocks: stat | `packages/blocks/src/components/sections/stats-counter.tsx` (StatsCounter) | changed since our port | Generic equivalent, not a Glide port. |
| `sticky-atc.liquid` | Sticky add-to-cart bar | product | placement | `components/sticky-atc.tsx` (StickyAtc) | ported (phase 2) | Follows the selected variant through a `variant:changed` event. |
| `tab-panel-cards.liquid` | Tab product cards (Section Rendering API) | none | none (helper) | - | not needed | Helper for tabbed-products. |
| `tabbed-products.liquid` | Tabbed product grid | index | heading, heading_alignment, show_tab_counts, heading_follows_tab, columns +1 more; blocks: tab | `sections/glide/tabbed-products.tsx` (ProductGrid, refreshed in place) | ported (phase 2) | Tab counts, heading alignment, heading follows tab. Old tabs still render. |
| `trust-bar.liquid` | Strip of trust claims under the hero | none | gst_note; blocks: claim | - | missing |  |
| `video-scroll.liquid` | Scroll-scrubbed video | none | video, video_url, poster, scroll_length | - | missing |  |
| `video-story.liquid` | Scroll-driven video with captions | none | video, video_url, poster, tint_opacity, scroll_length; blocks: caption | - | missing |  |
| `video.liquid` | Video section, embedded or self-hosted | none | heading, video, video_url, poster, width | `packages/blocks/src/components/sections/video.tsx` (Video) | identical | Theme older than our port. Width setting not exposed. |
| `wishlist-card.liquid` | Wishlist card content (Section Rendering API) | none | none (helper) | - | not needed | Helper for the wishlist page. |
| `wishlist.liquid` | Saved products page | page.wishlist | heading | - | missing |  |

Our ports that have no Glide source: `collection-list` and `image-banner` were ported from Dawn-style
names. Glide has no `collection-list.liquid` or `image-banner.liquid`; the nearest are `category-tiles`
and `overlay-banner`, listed above as `missing`. Our `CollectionList` and `ImageBanner` stay as
generic blocks.

## Counts by status

| Status | Sections |
| --- | --- |
| identical | 3 |
| changed since our port | 13 |
| missing | 42 |
| not needed | 18 |
| ported (phase 1) | 14 |
| ported (phase 2) | 24 |
| **Total** | **114** |

## Home page map (`templates/index.json`)

| # | Section | Template id | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | hero-carousel | hero | changed since our port | 3 video slides plus image slides |
| 2 | ships-today | ships_today | ported (phase 1) | |
| 3 | category-panels | category_panels | ported (phase 1) | |
| 4 | tabbed-products | tabbed-products | changed since our port | 6 tabs |
| 5 | featured-carousel | featured_carousel | ported (phase 1) | 7 slides |
| 6 | reviews-showcase | reviews_showcase | ported (phase 1) | |
| 7 | promo-bento | promo_bento_ERWCtg | ported (phase 1) | |
| 8 | latest-drop | latest-drop | ported (phase 1) | |
| 9 | drops-teaser | drops_teaser | ported (phase 1) | |
| 10 | perfect-match | perfect-match | ported (phase 1) | |
| 11 | brand-lab | brand-lab | ported (phase 1) | |
| 12 | logo-carousel | logos | ported (phase 1) | |
| 13 | drop-reveal | drop-reveal | ported (phase 1) | |
| 14 | notes-series | notes_series | ported (phase 1) | |
| 15 | social-wall | social-wall | ported (phase 1) | |
| 16 | discord-cta | discord | ported (phase 1) | |
| off | featured-product | featured_product | changed since our port | Disabled |
| off | reviews | reviews | missing | Disabled |
| off | image-comparison | glass_vs_cloth | missing | Disabled |

Phase 1 covers rows 2, 3, 5 to 16. Rows 1 and 4 already have older ports that need a refresh
(proposed for phase 2 with the other `changed since our port` sections, see the end).

## Section groups

| Group | Section | Status |
| --- | --- | --- |
| header-group | announcement-bar (5 announcements) | changed since our port |
| header-group | header | changed since our port |
| footer-group | newsletter | changed since our port |
| footer-group | footer | changed since our port |
| footer-group | mobile-dock (4 links) | missing |
| footer-group | cookie-banner | missing |
| footer-group | signup-popup x3 (popup_corner, popup_figure, popup_feed) | missing |

Our groups live in `packages/core/src/theme/templates.ts`: header is `AnnouncementBar` + `Header`;
footer allows `Footer`, `Newsletter`, `RichText`, `Multicolumn`, `LogoList`.

## Global theme settings

Glide has 11 settings groups in `config/settings_schema.json`; current values are from
`config/settings_data.json`. Ours are the `Theme` type in `packages/core/src/theme/schema.ts`, turned
into CSS variables by `packages/core/src/theme/vars.ts` (defaults in
`packages/blocks/src/styles/base.css`), and edited in
`apps/admin/src/components/themes/{brand,colour,typography,layout,button,card}-settings.tsx`.

| Glide setting | Glide value | Our setting | Status |
| --- | --- | --- | --- |
| logo | waimers-logo.png | `brand.logo` (brand-settings) | mapped |
| logo_dark | waimers-logo-dark.png | none (one logo only) | missing |
| logo_width | 140 | `brand.logoWidth` (`--logo-width`) | mapped |
| favicon | waimers purple webp | `brand.favicon` | mapped |
| color_schemes (8 roles: background, text, text_muted, line, surface, button, button_text, accent) | 5 schemes: scheme-1 white, 2 night, 3 charcoal, 4 purple, 5 mist | `schemes[]` with the same 8 roles (`--color-bg`, `-ink`, `-muted`, `-line`, `-surface`, `-brand`, `-on-brand`, `-accent`); `defaultTheme` carries the same five | mapped |
| colors_success | #1F9254 | `shared.success` | mapped |
| colors_danger | #D2331F | `shared.danger` | mapped |
| colors_warning | #B7791F (default) | none | missing |
| colors_info | #2F6FD6 (default) | none | missing |
| enable_dark_mode | true | `darkMode.enabled` | mapped |
| theme_toggle_position | header | `darkMode.togglePosition` | mapped |
| dark_swap_from | scheme-5 | `lightScheme` | mapped |
| dark_swap_to | scheme-3 | `darkScheme` | mapped |
| type_header_font | archivo_n7 | `fonts.heading` = archivo (curated list, no weight pick) | partial |
| type_body_font | figtree_n5 | `fonts.body` = figtree | partial |
| heading_scale | 100 (%) | `fonts.headingScale` 1 | mapped |
| body_size | 16 | `fonts.bodySizePx` | mapped |
| cjk_fallback | true | none (invoice PDFs have their own font handling) | missing |
| show_breadcrumbs | true (default) | none; breadcrumbs CSS exists, always on | missing |
| rounded_sections | true | `roundedSections` (`--section-radius`) | mapped |
| media_parallax | true | none; parallax CSS exists in base.css, always on | missing |
| card_scrub_images | 3 | `cards.hoverImage` on/off only | partial |
| card_indicator_style | dots | none | missing |
| colors_card_media | #f1f0f3 | none | missing |
| card_media_flat_dark | true | none | missing |
| colors_card_media_dark | #f1f0f3 | none | missing |
| card_media_blend | true | none | missing |
| card_strip_vendor_prefix | true (default) | none (`cards.showVendor` shows or hides the vendor) | missing |
| dispatch_cutoff_hour | 12 | none; ships-today carries its own `cutoff_hour` | missing |
| free_shipping_threshold | 999 | none as a theme setting; free shipping is a discount rule in core | partial |
| cart_recommendations_collection | unset | none | missing |
| upi_nudge_card, upi_nudge_sheet | on (default) | none | missing |
| upi_percent | 3 (default) | none | missing |
| upi_method_name, upi_other_method, upi_steps | defaults (UPI ID or Bank Deposit text) | none | missing |
| social_instagram | instagram.com/_waimers/ | none in theme settings | missing |
| social_discord | discord.gg/v8mDs77cCY | none in theme settings | missing |
| social_youtube | youtube.com/@waimers_aim | none in theme settings | missing |
| social_twitter | x.com/w_aimers | none in theme settings | missing |

Settings we have that Glide does not (Glide hardcodes these in CSS): `shape.buttonRadius`,
`cardRadius`, `inputRadius`, `borderWidth`; `layout.pageWidth`, `sectionSpacing`; `buttons.style`,
`colour`, `uppercase`; `cards.imageRatio`, `showSaleBadge`; `fonts.headingTracking`; `sharedDark`;
`shared.sale`; `preset`.

Open decisions: where socials, the UPI nudge and the dispatch cutoff live (theme settings vs store
settings). Footer, discord-cta, social-wall and announcement-bar all need socials, so phase 2 should
settle it first. Card media colour, blend and scrub need a cards-group extension and product-card CSS
work, so they ride with the product-card refresh in phase 2.

## Phase 2 batch: header, footer, product page

Also refresh the two home sections with older ports, since they share the card and hero work:
hero-carousel and tabbed-products.

Header group (`sections/header-group.json`):

| Section | Status |
| --- | --- |
| announcement-bar | changed since our port |
| header | changed since our port |

Footer group (`sections/footer-group.json`):

| Section | Status |
| --- | --- |
| newsletter | changed since our port |
| footer | changed since our port |
| mobile-dock | missing |
| cookie-banner | missing |
| signup-popup (3 styles) | missing |

Product page (`templates/product.json`): main-product with its buy-box blocks (title, rating, price,
variant_picker, buy_buttons, payment_signals, delivery_estimate, 4 accordions, share_row, stock_bar,
spec_group, trust_badges, returns_line, whatsapp_ask, assurance, razorpay_emi), then:

| Section | Status |
| --- | --- |
| main-product | changed since our port |
| product-specs | missing |
| product-size-guide | missing |
| product-tabs (description, add-ons, more tabs) | missing |
| sticky-atc | missing |
| product-size-table | missing |
| related-products | changed since our port |

## Phase 3 batch: everything else, by template

| Template | Sections | Status |
| --- | --- | --- |
| collection | main-collection, related-collections | changed since our port, missing |
| list-collections (+ .brands, .drops) | main-list-collections | missing |
| cart | main-cart (plus cart-drawer from `layout/theme.liquid`) | changed since our port, missing |
| search | main-search | changed since our port |
| customers/* (account, login, register, order, addresses, activate, reset) | main-customers-* | not needed (native account pages) |
| blog | main-blog | changed since our port |
| article | main-article | changed since our port |
| article.notes | main-article-notes, article-series | missing |
| 404 | main-404 | changed since our port |
| password | password | not needed |
| page | main-page | changed since our port |
| page.find-your-match | guide-entry, concierge-form | missing |
| page.guide-keyboard, page.guide-mouse, page.guide-pad | guide-quiz, guide-ranking, guide-essentials, concierge-form | missing |
| page.about | image-with-text x2, stat-counter, review-stack, image-gallery, roadmap-timeline, discord-cta | mixed (discord-cta lands in phase 1) |
| page.contact | contact-form | missing |
| page.faq | collapsible-content | identical |
| page.hall-of-fame | hall-of-fame | missing |
| page.preorder-updates | preorder-updates | missing |
| page.reviews | main-page, reviews-showcase (phase 1), reviews, apps (off) | mixed |
| page.roadmap | roadmap-timeline | missing |
| page.software | software-index | missing |
| page.tracking | order-tracking | missing |
| page.wishlist | wishlist | missing |

Suggested order inside phase 3: collection and list-collections, cart and cart drawer, search, then
blog/article/notes, then pages (about, contact, faq, reviews, tracking, wishlist, hall-of-fame,
roadmap, software, preorder-updates), then guides last (the quiz is the largest piece).

## Phase 4 backlog: sections no template uses

These exist in the theme but are placed on no template, so they only matter if the owner wants them
in the Add-section menu: banner-mosaic, banner-reveal, bento-categories, blog-posts, category-tiles,
comparison-table, complete-setup, countdown-timer, feature-scroller, featured-products, fit-explorer,
guide-fit, guide-tiles, multicolumn, overlay-banner, product-bundle, product-features,
product-spec-strip, product-spotlight, promo-banners, promo-popup, quick-order-list, restock-alerts,
rich-text, scrolling-text, shop-by-spec, shop-the-look, trust-bar, video, video-scroll, video-story.

## Phase 2: UI-kit effects

Where the theme re-implemented a Magic UI or Aceternity UI effect in its own JS or CSS, phase 2 uses
the original component instead, adapted once in `packages/blocks/src/effects/` (theme colours, rem,
reduced motion, fine-pointer guards; provenance comment in each file):

| Effect | Source | Used by |
| --- | --- | --- |
| Marquee, 3D Marquee demo, Safari | Magic UI (MIT) | Reviews showcase, announcement bar marquee |
| Lens | Aceternity UI (free) | Product gallery |
| 3D Card | Aceternity UI (free) | Latest drop |
| Meteors | Aceternity UI (free) | Newsletter |
| Animated Tooltip | Aceternity UI (free) | Reviews showcase avatars |
| Focus Cards | Aceternity UI (free) | Brand lab |

Not swapped: category panels keep the theme's hover-widening row. The theme calls it its Aceternity
"expandable cards" pick, but the free Aceternity Expandable Card is a click-to-open modal list, and no
free original of the hover row exists; it needs the owner's Pro file or a decision. Tracing beam and
card stack belong to phase 3 sections (roadmap, review stack).

Not ported in phase 2 (phase 2b or later): product reviews data (sections show typed reviews or a
placeholder), related-products recommendation intent, product-tabs add-ons / recommendations /
Judge.me tabs, metafield-driven spec cells in the buy box, a wishlist page, and changing the default
product template to the theme's section order.
