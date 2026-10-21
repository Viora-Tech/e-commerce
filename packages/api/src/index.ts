export type { ApiContext, DailyVisitors, LiveVisitors, VisitorSource } from './context'
export { apiTokenRefusal } from './mcp/action-catalogue'
export { handleMcpDownload } from './mcp/download-link'
export {
  type AuthorizeParams,
  type AuthorizeRequest,
  authorizationServerMetadata,
  checkAuthorize,
  consentStore,
  decideAuthorize,
  handleRegister,
  handleRevoke,
  handleToken,
  OAUTH_CORS,
  protectedResourceMetadata,
} from './mcp/oauth'
export { clientIp, handleMcpRequest, mcpPath, resourceMetadataUrl } from './mcp/server'
export {
  base,
  createRequestMemo,
  isNoStoreError,
  protectedProcedure,
  type RequestMemo,
  remember,
  storeProcedure,
} from './procedures'
export { type AppRouter, appRouter } from './routers/_app'
export { channelDeps, queueChannelSync } from './routers/sales-channels'
export type {
  AnalyticsKpi,
  AnalyticsLive,
  AnalyticsOverview,
} from './services/analytics.service'
export type {
  ReportChartPoint,
  ReportResult,
  ReportRow,
  ReportValue,
} from './services/analytics-report.service'
export {
  findReport,
  REPORT_CATEGORIES,
  REPORTS,
  type ReportCategory,
  type ReportColumn,
  type ReportColumnKind,
  type ReportDefinition,
} from './services/analytics-reports'
export type { CustomerSheetRow } from './services/customer-sheet.service'
export {
  DASHBOARD_LOW_STOCK_THRESHOLD,
  type DashboardChartRange,
  type DashboardChartsData,
  type DashboardSummary,
} from './services/dashboard.service'
export type {
  GrowthOutcomes,
  OutcomeKind,
  OutcomeRow,
} from './services/growth-outcomes.service'
export type {
  HomeAnalytics,
  HomeCompare,
  HomeMetricFigures,
} from './services/home-analytics.service'
export type {
  CampaignRow,
  ChannelRow,
  MarketingKpi,
  MarketingOverview,
  OverviewChannel,
  SourceKey,
  SourceRow,
} from './services/marketing-overview.service'
export {
  normalizeSource,
  SOURCE_KEYS,
  SOURCE_LABELS,
} from './services/marketing-overview.service'
export type { OrderSheetRow } from './services/order-sheet.service'
