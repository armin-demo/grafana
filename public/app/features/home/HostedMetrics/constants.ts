/** Stable DOM id for the Hosted Metrics homepage widget (scroll / deep-link target). */
export const HOME_HOSTED_METRICS_ID = 'home-hosted-metrics';

/** Metrics Drilldown app path used by the widget CTA. */
export const METRICS_DRILLDOWN_PATH = '/a/grafana-metricsdrilldown-app';

/**
 * Grafana Cloud usage Prometheus datasource. Serves grafanacloud_instance_*
 * billable/usage series (not the stack's hosted metrics ingest DS).
 */
export const GRAFANA_CLOUD_USAGE_DATASOURCE_UID = 'grafanacloud-usage';

/**
 * PromQL for active series. Prefer Cloud billable/active series when present,
 * otherwise fall back to Prometheus TSDB head series (local / self-managed).
 */
export const ACTIVE_SERIES_QUERIES = [
  'sum(grafanacloud_instance_active_series)',
  'sum(prometheus_tsdb_head_series)',
] as const;

/**
 * PromQL for data points per minute. Cloud exposes samples/sec; local Prometheus
 * approximates from the head samples append rate.
 */
export const DPM_QUERIES = [
  'sum(grafanacloud_instance_samples_per_second) * 60',
  'sum(rate(prometheus_tsdb_head_samples_appended_total[5m])) * 60',
] as const;
