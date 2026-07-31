import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';

import { ACTIVE_SERIES_QUERIES, DPM_QUERIES, GRAFANA_CLOUD_USAGE_DATASOURCE_UID } from './constants';

export type HostedMetricsStats = {
  activeSeries: number | null;
  dpm: number | null;
  datasourceUid: string | null;
  datasourceName: string | null;
};

type PrometheusInstantQueryResponse = {
  status?: string;
  data?: {
    resultType?: string;
    result?: Array<{ value?: [number | string, string] }>;
  };
};

function parseInstantValue(response: PrometheusInstantQueryResponse): number | null {
  const raw = response?.data?.result?.[0]?.value?.[1];
  if (raw == null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function queryInstant(uid: string, expr: string): Promise<number | null> {
  try {
    const response = await getBackendSrv().get<PrometheusInstantQueryResponse>(
      `/api/datasources/proxy/uid/${encodeURIComponent(uid)}/api/v1/query`,
      { query: expr },
      undefined,
      { showErrorAlert: false }
    );
    return parseInstantValue(response);
  } catch {
    return null;
  }
}

async function firstMatchingValue(uid: string, exprs: readonly string[]): Promise<number | null> {
  for (const expr of exprs) {
    const value = await queryInstant(uid, expr);
    if (value != null) {
      return value;
    }
  }
  return null;
}

function isPrometheusLike(type: string): boolean {
  return type === 'prometheus' || type.includes('prometheus');
}

/**
 * Prefer grafanacloud-usage (Cloud instance_* series), then a Prometheus-compatible
 * metrics source. Instant /api/v1/query only works on Prometheus-like datasources.
 */
export function pickMetricsDatasourceUid(): { uid: string; name: string } | null {
  const list = getDataSourceSrv().getList({ metrics: true, tracing: false, annotations: false, variables: false });
  if (list.length === 0) {
    return null;
  }
  const prometheusLike = list.filter((ds) => isPrometheusLike(ds.type));
  const preferred =
    list.find((ds) => ds.uid === GRAFANA_CLOUD_USAGE_DATASOURCE_UID) ??
    prometheusLike.find((ds) => ds.isDefault) ??
    prometheusLike[0] ??
    null;
  if (!preferred?.uid) {
    return null;
  }
  return { uid: preferred.uid, name: preferred.name };
}

/**
 * Load quick-glance Hosted Metrics stats from a Prometheus-compatible datasource.
 * Returns nulls for missing metrics rather than throwing — the widget owns empty/error UI.
 */
export async function fetchHostedMetricsStats(): Promise<HostedMetricsStats> {
  const ds = pickMetricsDatasourceUid();
  if (!ds) {
    return { activeSeries: null, dpm: null, datasourceUid: null, datasourceName: null };
  }

  const [activeSeries, dpm] = await Promise.all([
    firstMatchingValue(ds.uid, ACTIVE_SERIES_QUERIES),
    firstMatchingValue(ds.uid, DPM_QUERIES),
  ]);

  return {
    activeSeries,
    dpm,
    datasourceUid: ds.uid,
    datasourceName: ds.name,
  };
}
