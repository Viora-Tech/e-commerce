export {
  ARTICLE_NUMBER_PROBLEMS,
  normaliseArticleNumber,
  parseArticleNumber,
  s10CheckDigit,
} from './article-number'
export {
  INDIA_POST_CAPABILITIES,
  INDIA_POST_ID,
  INDIA_POST_TRACKING_PAGE,
  indiaPostLabelPath,
} from './client'
export * from './data/speed-post-parcel-tariff'
export {
  decodeLabelRef,
  encodeLabelRef,
  type IndiaPostConfig,
  IndiaPostProvider,
  indiaPostFactory,
  type LabelRef,
  MANUAL_STATUS_WORDING,
  mapIndiaPostStatus,
  SPEED_POST,
  SPEED_POST_REGISTERED,
  trackingUrlFor,
} from './india-post'
export { PINCODE_API_URL, PinDirectory, placeFromApi } from './pin-directory'
export { indiaPostPlugin } from './plugin'
export { freightRupees, parseTariffOverride, priceParcel, publishedCard } from './tariff'
export * from './zones'
