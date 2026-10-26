/**
 * Sweep: an exported value (function/const/class — types are exempt) in `packages/<pkg>/src`
 * should have an importer somewhere else in the repo. A package's public entry (the
 * `exports` map in its `package.json`) counts as consumed as soon as anything imports
 * that package at all, since its individual named exports are its public API. Test-only
 * use doesn't count (a symbol used only from a `.test.ts` is still an orphan).
 *
 * Ratchet: today's orphans are frozen in ALLOWLIST (grouped by file, one reason each —
 * "no external importer today"; each is a candidate for deletion or for wiring up).
 * A newly-added export with no importer fails the sweep.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportedValues, listFiles, loadSourceFile, parseImports, ROOT, toRel } from './walk'

type AllowEntry = { file: string; names: string[]; reason: string }

const ALLOWLIST: AllowEntry[] = [
  {
    file: 'packages/core/src/inbox/widget.ts',
    names: [
      'WIDGET_ICONS',
      'WIDGET_HORIZONTAL',
      'WIDGET_VERTICAL',
      'DEFAULT_INBOX_WIDGET',
      'INBOX_WIDGET_FIELDS',
    ],
    reason:
      'the Inbox app embed schema the theme editor App embeds panel renders (coordinator, 2026-10-24); read once that panel lands',
  },
  {
    file: 'packages/core/src/inbox/connection.ts',
    names: ['EVENT_TYPES'],
    reason:
      'the browser side of Inbox realtime, used by the admin inbox (PR 4) and the widget (PR 5); unit-tested here',
  },
  {
    file: 'packages/core/src/inbox/realtime.ts',
    names: ['createInboxHub', 'sseFrame'],
    reason:
      'the hub and the SSE frame behind processInboxHub and inboxStreamResponse, exported for their unit tests',
  },
  {
    file: 'packages/core/src/inbox/events.ts',
    names: ['storeReplay'],
    reason: 'the admin stream replay behind replayForStore, exported for its unit test',
  },
  {
    file: 'packages/db/src/inbox-schema.ts',
    names: [
      'INBOX_CHANNELS',
      'INBOX_STATUSES',
      'INBOX_BLOCKED_REASONS',
      'INBOX_SENDERS',
      'INBOX_MESSAGE_KINDS',
      'INBOX_BLOCK_KINDS',
      'memberPushSubscription',
    ],
    reason:
      'Inbox contract (feat/inbox-core, 2026-10-24): read by the stream routes, the admin /inbox page and the storefront widget in Inbox PRs 2 to 5, which remove these entries',
  },
  {
    file: 'packages/core/src/inbox/constants.ts',
    names: [
      'CONVERSATION_STATUSES',
      'BLOCKED_REASONS',
      'MESSAGE_SENDERS',
      'MESSAGE_KINDS',
      'BLOCK_KINDS',
    ],
    reason:
      'Inbox contract (feat/inbox-core, 2026-10-24): read by the stream routes, the admin /inbox page and the storefront widget in Inbox PRs 2 to 5, which remove these entries',
  },
  {
    file: 'packages/core/src/inbox/rules.ts',
    names: ['linkCount'],
    reason:
      'Inbox contract (feat/inbox-core, 2026-10-24): read by the stream routes, the admin /inbox page and the storefront widget in Inbox PRs 2 to 5, which remove these entries',
  },
  {
    file: 'packages/core/src/inbox/settings.ts',
    names: [
      'InboxDayHoursSchema',
      'DEFAULT_INBOX_HOURS',
      'INBOX_AVAILABILITY',
      'InboxSettingsSchema',
      'DEFAULT_INBOX_SETTINGS',
      'zonedWeekMinute',
    ],
    reason:
      'Inbox contract (feat/inbox-core, 2026-10-24): read by the stream routes, the admin /inbox page and the storefront widget in Inbox PRs 2 to 5, which remove these entries',
  },
  {
    file: 'packages/core/src/inbox/shopper.ts',
    names: ['ShopperSendSchema', 'customerConversations'],
    reason:
      'Inbox contract (feat/inbox-core, 2026-10-24): read by the stream routes, the admin /inbox page and the storefront widget in Inbox PRs 2 to 5, which remove these entries',
  },
  {
    file: 'packages/core/src/pixels/hash.ts',
    names: [
      'sha256',
      'normaliseEmail',
      'normaliseMetaPhone',
      'normaliseName',
      'normaliseCity',
      'normaliseState',
      'normalisePin',
      'splitName',
    ],
    reason: 'the Meta normalisers behind hashUserData; exported for their unit tests',
  },
  {
    file: 'packages/core/src/pixels/meta.ts',
    names: ['META_GRAPH', 'classifyMetaError'],
    reason:
      'the Graph base URL and error classifier behind sendMetaEvents; exported for their unit tests',
  },
  {
    file: 'packages/core/src/pixels/prune.ts',
    names: ['prunePixelData'],
    reason: 'the prune for one store, behind runPixelPruneJob; exported for its unit test',
  },
  {
    file: 'packages/core/src/pixels/send.ts',
    names: ['PixelRetryError'],
    reason: 'thrown so BullMQ retries a send job; exported for its unit test',
  },
  {
    file: 'packages/ui/src/globe/webgl/sprite-dots.ts',
    names: ['MAX_SPRITE_DOT_SAMPLES', 'spriteDotSpacing'],
    reason:
      'the sample cap and dot spacing behind pickSpriteDotSamples and spriteDotRadiusPx; exported for their unit test',
  },
  {
    file: 'packages/core/src/automations/engine/maintenance.ts',
    names: ['pruneAutomationRuns'],
    reason: 'the prune for one store, behind runAutomationPruneJob; exported for its unit test',
  },
  {
    file: 'packages/core/src/inventory/stock-events.ts',
    names: ['stockCrossings'],
    reason: 'the pure low/out crossing rule behind watchStockCrossings, exported for its unit test',
  },
  {
    file: 'packages/core/src/automations/actions/index.ts',
    names: ['builtinExecutors', 'missingBuiltinExecutors'],
    reason:
      'the executor list and its completeness check, exported for the catalogue-coverage test',
  },
  {
    file: 'packages/core/src/automations/conditions/evaluate.ts',
    names: ['readPath'],
    reason: 'the dotted-path reader behind the evaluator, exported for its unit test',
  },
  {
    file: 'packages/core/src/marketing/automation-cutover.ts',
    names: ['lockAutomationsEngineMode', 'cutoverStoreToEngine', 'verifyCutover'],
    reason:
      'the Growth cut-over steps, run by scripts/migrate-marketing-automations.ts (scripts are not scanned)',
  },
  {
    file: 'packages/core/src/marketing/automation-engine-map.ts',
    names: ['ENGINE_SUBJECT', 'nodeIdsFor', 'ruleFor'],
    reason: 'pieces of the legacy-to-engine mapping, exported for its unit test',
  },
  {
    file: 'packages/core/src/marketing/growth-automations.ts',
    names: ['stepsFromDefinition', 'engineAutomationStats'],
    reason: 'the engine-to-Growth view helpers, exported for the cut-over and parity tests',
  },
  {
    file: 'packages/core/src/marketing/growth-engine.ts',
    names: ['SWEEP_TRIGGERS', 'isTransactionalNode'],
    reason: 'the sweep trigger list and the COD transactional rule, exported for their unit tests',
  },
  {
    file: 'packages/core/src/automations/catalogue.ts',
    names: ['FIELD_TYPES', 'isPluginPieceId', 'builtinTrigger', 'conditionFieldsFor'],
    reason:
      'Automations contract (feat/automations, 2026-10-23): read by the admin editor and the conditions/actions work built in parallel on this branch',
  },
  {
    file: 'packages/core/src/automations/definition.ts',
    names: ['RULE_OPERATORS', 'RULE_QUANTIFIERS', 'RuleGroupSchema'],
    reason:
      'Automations contract (feat/automations, 2026-10-23): read by the admin editor and the conditions/actions work built in parallel on this branch',
  },
  {
    file: 'packages/core/src/automations/merge-tags.ts',
    names: ['readPath', 'mergeTagsIn'],
    reason:
      'Automations contract (feat/automations, 2026-10-23): read by the admin editor and the conditions/actions work built in parallel on this branch',
  },
  {
    file: 'packages/core/src/automations/types.ts',
    names: [
      'WORKFLOW_STATUSES',
      'WORKFLOW_ORIGINS',
      'BUILTIN_SUBJECT_TYPES',
      'STEP_RUN_STATUSES',
      'ACTION_RISKS',
      'TRIGGER_SOURCES',
      'RUN_REASONS',
      'STEP_RUN_RETENTION_DAYS',
    ],
    reason:
      'Automations contract (feat/automations, 2026-10-23): read by the admin editor and the conditions/actions work built in parallel on this branch',
  },
  {
    file: 'packages/core/src/automations/engine/trigger.ts',
    names: ['eventForOutbox'],
    reason: 'the outbox row to automation event rule, exported for its unit test',
  },
  {
    file: 'packages/core/src/automations/registry.ts',
    names: ['resetActionExecutorsForTest'],
    reason: 'lets engine tests install mock executors',
  },
  {
    file: 'packages/core/src/platform-apps/meta-callbacks.ts',
    names: ['whatsappEventUpdate'],
    reason:
      'one WhatsApp webhook change to an account update, behind handleMetaWebhook; exported for its unit test',
  },
  {
    file: 'packages/plugin-shopify-import/src/app-install.ts',
    names: ['signInstallState'],
    reason: 'the signed state inside shopifyInstallUrl; exported so the callback test can sign one',
  },
  {
    file: 'packages/api/src/services/order-actions.service.ts',
    names: ['orderActionGroups'],
    reason:
      'the pure who-sees-which-order-action rule behind apps.orderActions, exported for its unit test',
  },
  {
    file: 'packages/api/src/services/ai/query-writer.ts',
    names: ['writeValidQuery'],
    reason:
      'the write-parse-retry loop behind refineQuery, exported for its unit test (no AI call)',
  },
  {
    file: 'packages/core/src/analytics-query/controls.ts',
    names: ['setShow'],
    reason: 'the metric-order rule behind toggleMetric, exported for its unit test',
  },
  {
    file: 'packages/core/src/catalog/stock-state.ts',
    names: ['STOCK_FILTER_PARAM', 'stockFilterState'],
    reason:
      'the state ↔ `?stock=` spelling map that STOCK_FILTERS must cover, exported for its unit test',
  },
  {
    file: 'packages/core/src/sender-email/platform.ts',
    names: ['platformEmailFromEnv'],
    reason:
      'builds the platform email account from given env (SES/Resend, fallback), exported for its unit test',
  },
  {
    file: 'packages/blocks/src/components/product-payment-signals.tsx',
    names: ['upiPricePaise'],
    reason: 'the checkout-matching UPI price behind the offer note, exported for its unit test',
  },
  {
    file: 'packages/blocks/src/components/product-variant-picker.tsx',
    names: ['swatchImages'],
    reason: 'the swatch-or-pill rule behind the variant picker, exported for its unit test',
  },
  {
    file: 'packages/core/src/theme-import/main-product-props.ts',
    names: ['plainText'],
    reason: 'the rich text to inline copy rule behind mainProductProps, exported for its unit test',
  },
  {
    file: 'packages/core/src/theme-import/product-fields.ts',
    names: ['productDisplayFields'],
    reason: 'the pure shaping behind loadProductPageExtras, exported for its unit test (no DB)',
  },
  {
    file: 'packages/plugin-shopify-import/src/write-products.ts',
    names: ['preorderFrom'],
    reason:
      'the inventory-policy to pre-order rule behind the product write, exported for its unit test',
  },
  {
    file: 'packages/db/src/storefront-cache.ts',
    names: [
      'STOREFRONT_CACHE_CHANNEL',
      'STOREFRONT_CACHE_TABLES',
      'STOREFRONT_CACHE_SOFT_TABLES',
      'STOREFRONT_CACHE_EXEMPT',
      'parseStorefrontCachePayload',
    ],
    reason:
      'the cache trigger classification and payload format, read by its test (the ratchet that makes every new store table pick a side)',
  },
  {
    file: 'packages/core/src/member-account/profile.ts',
    names: ['normaliseMemberPhone'],
    reason: 'the E.164 rule behind MemberProfileInputSchema, exported for its unit test',
  },
  {
    file: 'packages/core/src/member-account/email-change.ts',
    names: ['maskEmail'],
    reason: 'the masking rule behind the email-changed notice, exported for its unit test',
  },
  {
    file: 'packages/core/src/member-account/sign-ins.ts',
    names: ['maskIp', 'signInMethod'],
    reason:
      'the IP masking and method rules behind recordMemberSignIn, exported for their unit test',
  },
  {
    file: 'packages/core/src/inventory/landed-cost.ts',
    names: ['allocate'],
    reason: 'the largest-remainder split behind computeLandedCosts, exported for its unit test',
  },
  {
    file: 'packages/core/src/payments/charges.ts',
    names: ['merchantFee'],
    reason: 'the shopper-paid-fee split behind recordPaymentCharges, exported for its unit test',
  },
  {
    file: 'packages/db/src/finance-schema.ts',
    names: ['MONTHLY_EXPENSE_CATEGORIES'],
    reason: 'the table check list, exported so core monthly-expenses.test.ts checks it matches',
  },
  {
    file: 'packages/core/src/inventory/schemas.ts',
    names: ['FxRateSchema'],
    reason: 'the exchange-rate rule inside the purchase schemas, exported for its unit test',
  },
  {
    file: 'packages/db/src/purchasing-schema.ts',
    names: ['INBOUND_SHIPMENT_STATUS_VALUES', 'PURCHASE_CHARGE_KIND_VALUES', 'SPLIT_METHOD_VALUES'],
    reason: 'the column enums; landed-cost.test.ts checks core keeps the same lists',
  },
  {
    file: 'packages/api/src/services/bug-report.service.ts',
    names: ['scrubSecrets'],
    reason: 'the redaction rule behind buildBugIssue, exported for its unit test',
  },
  {
    file: 'packages/core/src/theme-import/bundle.ts',
    names: ['nonceThemeScripts'],
    reason:
      'the source rewrite behind buildThemeBundle (nonces only on the theme own scripts, security audit 2026-10-06), exported for its unit test',
  },
  {
    file: 'packages/core/src/theme-import/engine.ts',
    names: ['LIQUID_LIMITS'],
    reason: 'the render budgets renderBounded applies, exported so security.test.ts can pin them',
  },
  {
    file: 'packages/core/src/theme-import/import-media.ts',
    names: ['THEME_MEDIA_LIMITS', 'liveVideosIn'],
    reason:
      'the download budget and live-page reader behind importShopifyTheme (security audit 2026-10-06), exported for their unit tests',
  },
  {
    file: 'packages/core/src/theme-import/fields.ts',
    names: ['settingsFromProps', 'shopifySectionId'],
    reason: 'the parts of liquidPlacement (props to engine input), exported for their unit tests',
  },
  {
    file: 'packages/core/src/theme-import/filter-values.ts',
    names: ['shopifyMoney'],
    reason: 'Shopify money formats behind the money filter, exported for its unit test',
  },
  {
    file: 'packages/core/src/theme-import/import.ts',
    names: ['cleanShopifyHost'],
    reason: 'thrown and used by importShopifyTheme, exported for its tests',
  },
  {
    file: 'packages/core/src/theme-import/settings-values.ts',
    names: ['liquidSettingValue'],
    reason: 'one setting of liquidSettings, exported for its unit test',
  },
  {
    file: 'packages/core/src/theme-import/schema.ts',
    names: ['stripJsonComments'],
    reason: 'the comment stripper behind parseThemeJson, exported for its unit test',
  },
  {
    file: 'packages/shipping/src/pincode.ts',
    names: ['buildPincodeDirectory'],
    reason:
      'used by scripts/build-pincode-directory.ts (builds the PIN code data file); scripts/ is outside this sweep',
  },
  {
    file: 'packages/core/src/secret-rotation.ts',
    names: ['rotateStoreSecrets'],
    reason:
      'used by scripts/rotate-secrets.ts (bun run rotate-secrets); scripts/ is outside this sweep',
  },
  {
    file: 'packages/core/src/store-data/export.ts',
    names: ['ENCRYPTED_PLACEHOLDER', 'REDACTED_PLACEHOLDER', 'redactRow'],
    reason: 'redaction rule behind buildStoreExport, exported for its unit test',
  },
  {
    file: 'packages/core/src/store-data/service.ts',
    names: ['purgeExpiredExports'],
    reason: 'run by runStoreExport after each build, exported for its unit test',
  },
  {
    file: 'packages/queue/src/fair.ts',
    names: ['fairnessKey', 'storeSlots'],
    reason: 'the slot store behind fairProcessor, exported for its unit test',
  },
  {
    file: 'packages/core/src/media/service.ts',
    names: ['DEFAULT_STORAGE_QUOTA_BYTES', 'storageUsageBytes', 'checkStorageQuota'],
    reason:
      'storage quota hook from #182, not enforced yet; kept for a Settings > Files usage page',
  },
  {
    file: 'packages/plugin-shopify-import/src/bulk.ts',
    names: ['BulkUnavailableError'],
    reason:
      'from #180; thrown in this file only, no importer checks for it yet — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/shopify-api.ts',
    names: ['PRODUCTS_BULK_QUERY', 'CUSTOMERS_BULK_QUERY', 'ORDERS_BULK_QUERY'],
    reason:
      'from #180; used in this file only, exported for inspection, investigate before removing',
  },
  {
    file: 'packages/api/src/services/analytics-buckets.ts',
    names: ['DEFAULT_RANGE'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/api/src/services/collection.service.ts',
    names: ['collectionByHandle', 'activeCollections'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/api/src/services/customer.service.ts',
    names: ['lapsedSince'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/api/src/services/discount.service.ts',
    names: ['lifecycleOf'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/api/src/services/order-fulfil.service.ts',
    names: ['customerName'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/api/src/services/page.service.ts',
    names: ['getPublishedPageByHandle'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/api/src/services/staff.service.ts',
    names: ['assertGrantable'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/accounts/addresses.ts',
    names: ['MAX_ADDRESSES'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/accounts/auth.ts',
    names: ['CUSTOMER_SESSION_TTL_MS', 'hashSessionToken'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/payments/confirm.ts',
    names: ['gatewayPaidTooLittle'],
    reason: 'exported for its unit test (amount-check.test.ts); used inside applyPaymentStatus',
  },
  {
    file: 'packages/core/src/apps/settings.ts',
    names: ['AppsSettingsSchema', 'defaultAppsSettings'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/blog/schemas.ts',
    names: ['ArticleStatusSchema'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/blog/service.ts',
    names: ['uniqueBlogHandle', 'uniqueArticleHandle', 'ensureDefaultBlog', 'resolvePublication'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/blog/text.ts',
    names: ['richTextToText', 'isArticleVisible'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/cart/abandoned.ts',
    names: [
      'RECOVERY_TTL_MS',
      'getAbandonedCart',
      'recoveryToken',
      'recoveryPath',
      'cartsAwaitingRecovery',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/catalog/products.ts',
    names: ['setOptionsAndVariants', 'setOnHand', 'adjustInventory'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/catalog/schemas.ts',
    names: [
      'VariantInputSchema',
      'OptionInputSchema',
      'PreorderPaymentModeSchema',
      'ProductFieldsSchema',
      'InventoryReasonSchema',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/collections/rules.ts',
    names: ['matchesCollectionCondition'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/collections/schemas.ts',
    names: [
      'CollectionKindSchema',
      'CollectionStatusSchema',
      'CollectionSortSchema',
      'CollectionConditionSchema',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/collections/service.ts',
    names: ['uniqueCollectionHandle', 'ruleProducts', 'syncAutomaticCollection'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/discounts/evaluate.ts',
    names: ['eligibleLines'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/discounts/resolve.ts',
    names: ['loadDiscountCart', 'findDiscountByCode', 'listAutomaticDiscounts'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/discounts/schemas.ts',
    names: [
      'DiscountKindSchema',
      'DiscountMethodSchema',
      'DiscountAppliesToSchema',
      'DiscountStatusSchema',
      'DiscountCodeSchema',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/domains/dev-provider.ts',
    names: ['DEV_SSL_ISSUE_MS'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/domains/records.ts',
    names: ['relativeName'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/domains/routes.ts',
    names: ['ROUTE_RETRY_MS'],
    reason: 'the route retry window behind needsRouteRequest, exported for its unit tests',
  },
  {
    file: 'packages/core/src/domains/certificate-retry.ts',
    names: ['checkCertificate', 'RETRY_REQUEST_GAP_MS'],
    reason:
      'the per-host check and the retry gap behind the sweep and the merchant button, exported for their unit tests',
  },
  {
    file: 'packages/core/src/domains/certificate.ts',
    names: ['DAY', 'CERT_RETRY_WINDOW_MS'],
    reason: 'the schedule constants behind certCheckDue, exported for its unit tests',
  },
  {
    file: 'packages/core/src/domains/service.ts',
    names: ['DOMAIN_PROVIDERS'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/errors.ts',
    names: ['PaymentFailed', 'PreorderLimitReached'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/gift-cards/service.ts',
    names: [
      'hashGiftCardCode',
      'issueGiftCardsForOrder',
      'undeliveredGiftCards',
      'giftCardPaymentsFor',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/inventory/schemas.ts',
    names: ['ManualReasonSchema', 'PurchaseOrderLineInputSchema'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/inventory/stock.ts',
    names: ['deltaToReach', 'stockState'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/marketing/attribution.ts',
    names: ['ATTRIBUTION_WINDOW_DAYS', 'hostOf', 'classifyChannel'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/marketing/automation-steps.ts',
    names: ['AutomationStepSchema'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/marketing/campaigns.ts',
    names: ['CAMPAIGN_BATCH_SIZE'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/marketing/email.ts',
    names: ['EmailBlockSchema'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/marketing/email-design.ts',
    names: ['decodeEntities', 'htmlToPlainText', 'hasUnsubscribeTag'],
    reason: 'exported for its unit test (email-design.test.ts)',
  },
  {
    file: 'packages/core/src/marketing/send.ts',
    names: ['withUtm'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/media/migrate.ts',
    names: ['MigrateStorageJobSchema'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/media/service.ts',
    names: ['productGallery'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/media/settings.ts',
    names: [
      'StorageMigrationSchema',
      'defaultStorageSettings',
      'encryptStorageSettings',
      'maskStorageSettings',
      'builtInStorageRegistry',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/metaobjects/schemas.ts',
    names: [
      'FIELD_TYPES',
      'FieldTypeSchema',
      'REFERENCE_TYPES',
      'KeySchema',
      'FieldValidationsSchema',
      'FieldDefinitionSchema',
      'MetaobjectStatusSchema',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/metaobjects/field-changes.ts',
    names: ['fieldChangeProblems'],
    reason: 'the pure rule behind storedFieldProblems (same file), exported for its unit test',
  },
  {
    file: 'packages/core/src/metaobjects/storefront.ts',
    names: ['metafieldsFor'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/metaobjects/validate.ts',
    names: ['isEmptyValue'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/navigation/items.ts',
    names: ['MENU_MAX_ITEMS', 'NavigationItemSchema'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/navigation/settings.ts',
    names: ['defaultNavigationSettings'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/notifications/enqueue.ts',
    names: ['notificationJobId'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/notifications/settings.ts',
    names: [
      'defaultNotificationSettings',
      'encryptNotificationSettings',
      'decryptNotificationSettings',
      'maskNotificationSettings',
      'builtInNotificationRegistry',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/order/drafts.ts',
    names: ['DraftLineSchema'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/order/fulfil.ts',
    names: ['NothingToFulfil', 'FulfilTooMany', 'OrderNotFulfillable'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/order/place-order.ts',
    names: ['checkGiftCardRules', 'placeOrder'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/order/status.ts',
    names: ['OrderStatusLocked'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/payments/attempts.ts',
    names: ['attemptKey', 'retryPayment', 'settleExpiredQrAttempt'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/payments/expiry.ts',
    names: ['EXPIRY_EXEMPT_METHODS', 'EXPIRED_NOTE', 'expiredUnpaidOrders', 'expireUnpaidOrder'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/payments/gateway-double.test-util.ts',
    names: ['GatewayDouble'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/payments/manual-followup.ts',
    names: [
      'MANUAL_METHOD',
      'REMINDER_EVERY_HOURS',
      'CANCEL_NOTICE_HOURS',
      'PaymentNotPending',
      'REMINDER_NOTE',
      'CANCEL_NOTICE_NOTE',
      'MANUAL_CANCELLED_NOTE',
      'nextManualStep',
      'sendUnpaidCancelNotice',
      'cancelUnpaidManualOrder',
      'manualFollowUpCandidates',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/payments/settings.ts',
    names: ['maskPaymentSettings', 'builtInPaymentRegistry'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/permissions/service.ts',
    names: ['writePermissions'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/plugins/events.ts',
    names: ['appEventJobId'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/preorder/balance-link.ts',
    names: ['BALANCE_LINK_TTL_MS', 'ORDER_LINK_TTL_MS', 'balanceToken', 'balancePath'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/preorder/balance-schedule.ts',
    names: [
      'nextBalanceStep',
      'BALANCE_CANCELLED_NOTE',
      'BALANCE_REFUND_BY_HAND_NOTE',
      'balanceCandidates',
      'sendBalanceReminder',
      'expireUnpaidBalance',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/preorder/balance.ts',
    names: ['BALANCE_REQUESTED_NOTE', 'openBalanceAttempt'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/providers/payment.ts',
    names: ['FakePaymentProvider'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/settings/secrets.ts',
    names: ['SECRET_KEY'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/shipping/ndr.ts',
    names: ['listNdrShipments', 'raiseNdr'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/shipping/pickup.ts',
    names: ['PickupNotSupported', 'listPickups'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/shipping/rates-service.ts',
    names: ['storeFreeShippingThreshold', 'cartWeightGrams'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/shipping/settings.ts',
    names: [
      'ShippingPolicySchema',
      'CourierRuleSchema',
      'BoxPresetSchema',
      'defaultCourierRule',
      'defaultShippingSettings',
      'encryptShippingSettings',
      'maskShippingSettings',
      'builtInShippingRegistry',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/shipping/shipments.ts',
    names: ['OPEN_SHIPMENT_STATUSES'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/theme/fonts.ts',
    names: ['fontVariable'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/theme/library.ts',
    names: ['presetThemeName'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/theme/preview-token.ts',
    names: ['THEME_PREVIEW_TTL_SECONDS'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/theme/schema.ts',
    names: ['ColorSchemeSchema'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/theme/vars.ts',
    names: ['themeToCssVars'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/cod-rto/settings.ts',
    names: ['codPrepaidDuePaise'],
    reason:
      'COD & RTO partial prepaid: the rule is saved and unit-tested; checkout calls it once split COD payments exist (handoff 2026-10-25-cod-rto-app)',
  },
  {
    file: 'packages/db/src/auth-schema.ts',
    names: ['verification'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/schema.ts',
    names: ['PAYMENT_STATUSES', 'METAFIELD_TYPES'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/seed-back-in-stock.ts',
    names: ['seedWaimersBackInStock', 'seedBackInStock'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/seed-demo-collections.ts',
    names: ['seedDemoCollections'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/seed-demo-drafts.ts',
    names: ['seedDemoDrafts'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/seed-demo-orders.ts',
    names: ['seedDemoOrders'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/seed-navigation.ts',
    names: ['seedNavigation'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/seed-shipping-rates.ts',
    names: ['seedShippingRates'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/seed.ts',
    names: ['seedDev'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/editor/src/nodes/collapsible-nodes.ts',
    names: [
      '$createCollapsibleContainerNode',
      '$createCollapsibleTitleNode',
      '$createCollapsibleContentNode',
      '$isCollapsibleContainerNode',
      '$isCollapsibleTitleNode',
      '$isCollapsibleContentNode',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/editor/src/nodes/image-node.tsx',
    names: ['$createImageNode', '$isImageNode'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/editor/src/nodes/youtube-node.tsx',
    names: ['$createYouTubeNode', '$isYouTubeNode'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/editor/src/plugins/markdown-transformers.ts',
    names: ['HR', 'IMAGE', 'TABLE'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/editor/src/utils/can-use-dom.ts',
    names: ['CAN_USE_DOM'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/invoices/src/document.ts',
    names: ['hsnFor', 'totalsOf', 'summariseByRate'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/invoices/src/gstr1.ts',
    names: ['B2CL_THRESHOLD_PAISE', 'gstr1Bucket', 'documentsIssued'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/invoices/src/numbering.ts',
    names: ['DOCUMENT_NUMBER_MAX', 'formatDocumentNumber', 'widestDocumentNumber'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/invoices/src/series.ts',
    names: ['widestSeriesNumber'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/invoices/src/settings.ts',
    names: ['PAPER_SIZES'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/invoices/src/snapshot.ts',
    names: [
      'NUMBERED_KINDS',
      'isNumberedKind',
      'PlaceSchema',
      'PartySchema',
      'DocumentLineSchema',
      'TaxRowSchema',
      'HsnRowSchema',
      'DocumentTotalsSchema',
      'ExportSupplySchema',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/invoices/src/words.ts',
    names: ['indianNumberInWords'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/notifications-whatsapp/src/whatsapp.ts',
    names: ['buildTemplatePayload', 'approvedTemplates'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/payments-razorpay/src/razorpay.ts',
    names: [
      'SNAPMINT_PROVIDER',
      'buildOrderNotes',
      'buildReceipt',
      'buildDisplayConfig',
      'buildMethodDisplayConfig',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/payments-razorpay/src/upi-qr.ts',
    names: ['buildQrNotes', 'qrCloseBy', 'upiIntentOf'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-back-in-stock/src/notify.ts',
    names: ['chunk', 'pendingSignupsFor'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-back-in-stock/src/plugin.ts',
    names: ['backInStockPlugin'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-back-in-stock/src/quota.ts',
    names: ['currentPeriod', 'usageThisMonth', 'freeQuotaFor'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-back-in-stock/src/settings.ts',
    names: ['defaultBackInStockStoreSettings', 'parseBackInStockStoreSettings'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-emi/src/plugin.ts',
    names: ['emiPlugin'],
    reason: 'imported only by the root commerce.config.ts, like backInStockPlugin',
  },
  {
    file: 'packages/plugin-affiliates/src/plugin.ts',
    names: ['affiliatesPlugin'],
    reason: 'imported only by the root commerce.config.ts, like formsPlugin',
  },
  {
    file: 'packages/plugin-affiliates/src/secrets.ts',
    names: ['AFFILIATE_CIPHER_COLUMNS', 'refreshAffiliatePhoneIndexes'],
    reason: 'imported only by scripts/rotate-secrets.ts (scripts are not counted as importers)',
  },
  {
    file: 'packages/plugin-forms/src/plugin.ts',
    names: ['formsPlugin'],
    reason: 'imported only by the root commerce.config.ts, like emiPlugin',
  },
  {
    file: 'packages/core/src/catalog/search-text.ts',
    names: ['maxEdits', 'editDistance', 'correctTerm', 'synonymsOf'],
    reason: 'test-only: the steps of planSearch, tested one by one in search-text.test.ts',
  },
  {
    file: 'packages/plugin-shopify-import/src/write-customers.ts',
    names: ['contactPhoneOf'],
    reason: 'test-only: the contact phone fallback (#810), tested in contact-phone.test.ts',
  },
  {
    file: 'packages/plugin-search/src/plugin.ts',
    names: ['searchPlugin'],
    reason: 'imported only by the root commerce.config.ts, like formsPlugin',
  },
  {
    file: 'packages/plugin-reviews/src/plugin.ts',
    names: ['reviewsPlugin'],
    reason: 'imported only by the root commerce.config.ts, like formsPlugin',
  },
  {
    file: 'packages/plugin-reviews/src/judgeme.ts',
    names: [
      'parseJudgemeCsv',
      'matchJudgemeRows',
      'curationOf',
      'matchRow',
      'countJudgemeRows',
      'importedStatus',
      'rowsToImport',
    ],
    reason: 'the pure CSV reader and the matcher, used inside this file and tested directly',
  },
  {
    file: 'packages/core/src/theme-import/data.ts',
    names: ['withReviewMetafields'],
    reason: 'the pure metafield merge, used inside this file and tested directly',
  },
  {
    file: 'packages/core/src/theme-import/related.ts',
    names: ['rankRelated'],
    reason: 'the pure ranking, used inside this file and tested directly',
  },
  {
    file: 'packages/plugin-gst-invoices/src/credit-notes.ts',
    names: ['creditNoteCutoff', 'issueCreditNote'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-gst-invoices/src/periods.ts',
    names: ['periodOf', 'periodRange', 'getPeriod'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-gst-invoices/src/queue.ts',
    names: ['B2C_DETAIL_THRESHOLD_PAISE', 'checkRule46'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-gst-invoices/src/render.ts',
    names: ['pdfKeyFor', 'renderSnapshot'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/connection.ts',
    names: ['maskToken'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/csv-orders.ts',
    names: ['shopifyDate'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/csv-products.ts',
    names: ['readHsn'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/html.ts',
    names: ['decodeEntities'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/api-files.ts',
    names: ['mapFile'],
    reason: 'Shopify file → our file shape (best mp4 pick), exported for its unit test',
  },
  {
    file: 'packages/plugin-shopify-import/src/field-values.ts',
    names: ['shopifyRichText', 'parseShopifyValue'],
    reason: 'Shopify field value readers, exported for their unit tests',
  },
  {
    file: 'packages/plugin-shopify-import/src/service.ts',
    names: ['csvKey'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/shopify-api.ts',
    names: [
      'SHOP_QUERY',
      'PRODUCTS_QUERY',
      'PRODUCT_VARIANTS_QUERY',
      'mapVariant',
      'mapProduct',
      'COLLECTIONS_QUERY',
      'COLLECTION_PRODUCTS_QUERY',
      'mapRules',
      'CUSTOMERS_QUERY',
      'mapAddress',
      'mapCustomer',
      'ORDERS_QUERY',
      'mapOrder',
      'PAGES_QUERY',
      'ARTICLES_QUERY',
      'MENUS_QUERY',
      'REDIRECTS_QUERY',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/shopify-client.ts',
    names: ['SHOPIFY_API_VERSION'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/write-content.ts',
    names: ['navigationItem'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/write-customers.ts',
    names: ['matchCustomer'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/write-orders.ts',
    names: ['PLACEHOLDER_HANDLE', 'statusFor'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-shopify-import/src/shopify-api.ts',
    names: ['productStatus'],
    reason: 'the Online Store visibility rule behind product status, exported for its unit test',
  },
  {
    file: 'packages/plugin-shopify-import/src/write-customers.ts',
    names: ['writeCustomer'],
    reason:
      'one-record writer the batched writer falls back to; exported for the fallback unit test',
  },
  {
    file: 'packages/plugin-shopify-import/src/issue-groups.ts',
    names: ['causeOf'],
    reason: 'classifies one problem; exported for its unit test',
  },
  {
    file: 'packages/plugin-shopify-import/src/status.ts',
    names: ['shopifyCounts', 'importStatus'],
    reason:
      'the two halves of remainingStatus (Shopify counts, then the numbers); exported for their unit tests',
  },
  {
    file: 'packages/plugin-shopify-import/src/write-orders.ts',
    names: ['writeOrder'],
    reason: 'one-record writer the batched writer falls back to; exported for its unit tests',
  },
  {
    file: 'packages/queue/src/visitors.ts',
    names: ['LIVE_MINUTES', 'EMPTY_LIVE_VISITORS', 'visitorsKey', 'visitorsDayKey'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/shipping/src/delivery-date.ts',
    names: [
      'isCivilDate',
      'isoWeekday',
      'daysBetween',
      'isWorkingDay',
      'nextWorkingDay',
      'addWorkingDays',
      'parseCutoff',
      'isValidTimeZone',
      'buildTrack',
    ],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/ui/src/components/global/mode-toggle/index.tsx',
    names: ['ModeToggle'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/shopper-login/identities.ts',
    names: ['decideLink'],
    reason:
      'the pure linking rule behind resolveShopperIdentity, exported so tokens.test.ts pins verified vs unverified email without a database',
  },
  {
    file: 'packages/core/src/shopper-login/providers.ts',
    names: ['appleClientSecret', 'identityFromUserInfo'],
    reason:
      'pure pieces of finishSignIn, exported so tokens.test.ts checks the Apple JWT and profile mapping without calling a provider',
  },
  {
    file: 'packages/core/src/shopper-login/credentials.ts',
    names: ['loginAppFrom'],
    reason: 'pure field-to-app builder behind loadOwnLoginApps, tested directly in tokens.test.ts',
  },
  {
    file: 'packages/core/src/shopper-login/truecaller.ts',
    names: ['truecallerNonce', 'isTruecallerEndpoint', 'mobileFromProfile'],
    reason:
      'pure pieces of startTruecaller/completeTruecaller (signed nonce, SSRF guard, number parsing), tested directly in tokens.test.ts',
  },
  {
    file: 'packages/core/src/onboarding/signup-gate.ts',
    names: ['isOwnerRole'],
    reason: 'pure rule behind userOwnsAStore (security audit 2026-09), exported for its unit test',
  },
  {
    file: 'packages/core/src/privacy/requests.ts',
    names: ['requestMatchesCustomer'],
    reason:
      'pure rule behind requestAnsweredFor (security audit 2026-09), exported for its unit test',
  },
  {
    file: 'packages/core/src/returns/resolve.ts',
    names: ['storeCreditCapPaise'],
    reason:
      'pure cap behind storeCreditReturn (security audit 2026-09), exported for its unit test',
  },
  {
    file: 'packages/core/src/shopper-login/identities.ts',
    names: ['connectDecision'],
    reason: 'pure rule behind planConnect (security audit 2026-09), exported for its unit test',
  },
  {
    file: 'packages/api/src/services/growth-outcomes.service.ts',
    names: ['OUTCOME_KINDS'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/api/src/services/growth-outcomes.service.ts',
    names: ['isEarned', 'outcomeTotals'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/api/src/services/order.service.ts',
    names: ['orderNumberFromSearch'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/api/src/services/short-links.service.ts',
    names: ['shortLinkStats'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/auth/src/merchant.ts',
    names: ['validateMerchantUserInfo'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/blocks/src/section-settings.ts',
    names: ['SECTION_BACKGROUND_TOKENS'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/catalog/bulk-edit-schemas.ts',
    names: ['BulkEditProductPatchSchema', 'BulkEditVariantPatchSchema', 'BulkEditRowSchema'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/order/profit-service.ts',
    names: ['ShipmentNotFound'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/order/routing-service.ts',
    names: ['loadRoutingLocations'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/order/routing.ts',
    names: ['MAX_ROUTING_LOCATIONS'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/redirects/csv.ts',
    names: ['REDIRECT_CSV_HEADERS'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/redirects/csv.ts',
    names: ['REDIRECT_CSV_MAX_ROWS'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/core/src/redirects/handle-change.ts',
    names: ['renameMenuTargets'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/core/src/returns/service.ts',
    names: ['sellingLocation'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/returns/service.ts',
    names: ['returnPickupLocation'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/core/src/secret-rotation.ts',
    names: ['rotateAppSettings'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/core/src/theme-import/import.ts',
    names: ['importedPages'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/core/src/theme-import/page-context.ts',
    names: ['resourceHandle'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/core/src/theme-import/report.ts',
    names: ['IMPORTED_TEMPLATES'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/theme/versions.ts',
    names: ['VERSIONS_KEPT'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/db/src/auth-schema.ts',
    names: ['memberSignIn'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/schema.ts',
    names: ['FULFILLMENT_ORDER_STATUSES'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/db/src/theme-schema.ts',
    names: ['THEME_TEMPLATE_KINDS'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/invoices/src/purchase-order/purchase-order-pdf.tsx',
    names: ['PurchaseOrderPdf'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-growthbook/src/plugin.ts',
    names: ['growthbookPlugin'],
    reason: 'listed in the root commerce.config.ts, which this sweep does not scan',
  },
  {
    file: 'packages/plugin-gst-invoices/src/queue.ts',
    names: ['enqueueOrder'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/plugin-chatwoot/src/plugin.ts',
    names: ['chatwootPlugin'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/plugin-chatwoot/src/plugin.ts',
    names: ['syncCustomerToChatwoot'],
    reason: 'exported for its unit test; no other importer today',
  },
  {
    file: 'packages/plugin-umami/src/plugin.ts',
    names: ['umamiPlugin'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/ui/src/icons-more.tsx',
    names: ['SidebarToggleIcon', 'Circle', 'Highlighter'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/sales-channels/connect.ts',
    names: ['signChannelState'],
    reason: 'the signed OAuth state behind the channel connect flow, exported for sync.test.ts',
  },
  {
    file: 'packages/core/src/shipping/courier-rates.ts',
    names: ['rateOptionLabel'],
    reason: 'the label rule behind the courier rate options, exported for its unit test',
  },
  {
    file: 'packages/core/src/theme-code/check.ts',
    names: ['checkCss', 'checkLiquid'],
    reason: 'the per-language checks behind codeProblems, exported for check.test.ts',
  },
  {
    file: 'packages/core/src/theme-code/files.ts',
    names: ['codeProblems'],
    reason: 'the save-time check behind the theme code editor, exported for check.test.ts',
  },
  {
    file: 'packages/ui/src/globe/webgl/border-dash.ts',
    names: ['DASH_DUTY_CYCLE', 'isDashVisible'],
    reason: 'the dash pattern the border shader draws, exported for its unit test',
  },
  {
    file: 'packages/ui/src/globe/webgl/border-points.ts',
    names: ['encodeBorderPoints'],
    reason: 'the border vertex packing, exported for its unit test',
  },
  {
    file: 'packages/ui/src/globe/webgl/dot-layout.ts',
    names: ['TARGET_ROW_SPACING_CSS_PX'],
    reason: 'the dot grid spacing, exported for its unit test',
  },
  {
    file: 'packages/core/src/analytics-query/schema.ts',
    names: ['QUERY_KEYWORDS'],
    reason: 'no external importer today — investigate before removing',
  },
  {
    file: 'packages/core/src/billing/apps.ts',
    names: ['canUseApp'],
    reason: 'no external importer today — billing API not wired into the admin yet',
  },
  {
    file: 'packages/core/src/billing/credits-service.ts',
    names: ['listAiTopups'],
    reason: 'no external importer today — billing API not wired into the admin yet',
  },
  {
    file: 'packages/core/src/billing/plans.ts',
    names: ['PLAN_GST_PERCENT', 'isPlanId'],
    reason: 'no external importer today — billing API not wired into the admin yet',
  },
  {
    file: 'packages/core/src/billing/service.ts',
    names: ['orderAllowance'],
    reason: 'no external importer today — billing API not wired into the admin yet',
  },
  {
    file: 'packages/core/src/catalog/browse.ts',
    names: ['metafieldFacets'],
    reason: 'the extra-field filter grouping behind listing filters, exported for its unit test',
  },
  {
    file: 'packages/core/src/order/test-orders.ts',
    names: ['discountReleases', 'countTestOrders'],
    reason: 'test order purge helpers, exported for their unit and database tests',
  },
  {
    file: 'packages/core/src/theme-import/related.ts',
    names: ['DISCOVERY_NAMESPACE'],
    reason: 'the Search & Discovery metafield namespace, exported for its unit test',
  },
  {
    file: 'packages/plugin-shopify-import/src/storefront-filters.ts',
    names: ['filterKeysFromHtml'],
    reason: 'the filter-key parser behind storefrontFilterKeys, exported for its unit test',
  },
]

function allowlistedNames(file: string): Set<string> {
  const out = new Set<string>()
  for (const e of ALLOWLIST) if (e.file === file) for (const n of e.names) out.add(n)
  return out
}

type Violation = { file: string; name: string; line: number }

async function findViolations(): Promise<Violation[]> {
  // Map @commerce/<dir> -> entry file paths (package.json "exports" targets ending in .ts/.tsx)
  const packagesRoot = path.join(ROOT, 'packages')
  const pkgDirs = readdirSync(packagesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  const nameByDir = new Map<string, string>()
  const entryFilesByDir = new Map<string, Set<string>>()
  for (const dir of pkgDirs) {
    try {
      const pj = JSON.parse(readFileSync(path.join(packagesRoot, dir, 'package.json'), 'utf8'))
      if (pj.name) nameByDir.set(dir, pj.name)
      const set = new Set<string>()
      for (const v of Object.values(pj.exports ?? {})) {
        if (typeof v === 'string' && /\.tsx?$/.test(v))
          set.add(`packages/${dir}/${v.replace('./', '')}`)
      }
      entryFilesByDir.set(dir, set)
    } catch {
      // no package.json / exports field — nothing to register
    }
  }

  const allFiles = await listFiles(['apps', 'packages'], { includeTests: true })
  const packageImportedExternally = new Set<string>()
  const importTexts: { file: string; text: string; isTest: boolean }[] = []
  for (const f of allFiles) {
    const rel = toRel(f)
    const isTest = /\.test\.tsx?$/.test(rel)
    const sf = loadSourceFile(f)
    const ownDir = rel.startsWith('packages/') ? rel.split('/')[1] : null
    for (const imp of parseImports(sf)) {
      importTexts.push({ file: rel, text: imp.text, isTest })
      if (!imp.hasValue) continue
      const specPkg = imp.specifier.startsWith('@')
        ? imp.specifier.split('/').slice(0, 2).join('/')
        : imp.specifier.split('/')[0]
      if (!specPkg.startsWith('@commerce/')) continue
      if (specPkg.replace('@commerce/', '') !== ownDir) packageImportedExternally.add(specPkg)
    }
  }

  const pkgFiles = (await listFiles(['packages'], { includeTests: false })).filter((f) =>
    toRel(f).includes('/src/'),
  )
  const violations: Violation[] = []
  for (const f of pkgFiles) {
    const rel = toRel(f)
    const dir = rel.split('/')[1]
    const pkgName = nameByDir.get(dir)
    const isEntry = (entryFilesByDir.get(dir) ?? new Set()).has(rel)
    const sf = loadSourceFile(f)
    for (const v of exportedValues(sf)) {
      if (isEntry && pkgName && packageImportedExternally.has(pkgName)) continue
      const used = importTexts.some(
        (imp) => imp.file !== rel && !imp.isTest && new RegExp(`\\b${v.name}\\b`).test(imp.text),
      )
      if (!used) violations.push({ file: rel, name: v.name, line: v.line })
    }
  }
  return violations
}

// Walks every import in the repo twice; slow under a parallel sweep run, so 2 minutes per test.
describe('sweep: no-orphans', () => {
  it('every exported value in packages/*/src has an importer, or is allow-listed', async () => {
    const violations = await findViolations()
    const unlisted = violations.filter((v) => !allowlistedNames(v.file).has(v.name))
    expect(
      unlisted,
      `orphaned exports (no importer found):\n${unlisted.map((v) => `${v.file}:${v.line} ${v.name}`).join('\n')}`,
    ).toEqual([])
  }, 120_000)

  it('the allow-list has no stale entries (each name is still an orphan)', async () => {
    const violations = await findViolations()
    const stale = ALLOWLIST.flatMap((e) =>
      e.names
        .filter((n) => !violations.some((v) => v.file === e.file && v.name === n))
        .map((n) => `${e.file}: ${n}`),
    )
    expect(stale, 'now imported (or deleted): remove from ALLOWLIST').toEqual([])
  }, 120_000)
})
