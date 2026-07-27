import { type DataSourceApi, type TimeRange } from '@grafana/data';

export interface MetricsLanguageProvider {
  start: (timeRange?: TimeRange) => Promise<unknown>;
  retrieveMetrics: () => string[];
  retrieveMetricsMetadata: () => Record<string, { type?: string; help?: string; unit?: string }>;
}

/**
 * Duck-types Prometheus-compatible datasources (Prometheus, Mimir, Thanos, vendored types)
 * without hardcoding `type === 'prometheus'`. Mixed datasources are excluded.
 */
export function isPrometheusCompatibleDatasource(
  datasource: DataSourceApi | null | undefined
): datasource is DataSourceApi & { languageProvider: MetricsLanguageProvider } {
  if (!datasource || datasource.meta?.mixed) {
    return false;
  }

  const languageProvider = datasource.languageProvider;
  return (
    languageProvider != null &&
    typeof languageProvider.start === 'function' &&
    typeof languageProvider.retrieveMetrics === 'function' &&
    typeof languageProvider.retrieveMetricsMetadata === 'function'
  );
}

export function getMetricsLanguageProvider(
  datasource: DataSourceApi | null | undefined
): MetricsLanguageProvider | undefined {
  if (!isPrometheusCompatibleDatasource(datasource)) {
    return undefined;
  }
  return datasource.languageProvider;
}
