export type { ApiContext, DailyVisitors, LiveVisitors, VisitorSource } from './context'
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
