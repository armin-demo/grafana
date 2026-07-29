import { config, reportInteraction } from '@grafana/runtime';

export type MetricsSidebarInteractionProps = {
  datasourceType: string;
  grafana_version: string;
  exploreId: string;
};

export function getMetricsSidebarInteractionProps(
  exploreId: string,
  datasourceType?: string | null
): MetricsSidebarInteractionProps {
  return {
    exploreId,
    datasourceType: datasourceType || 'unknown',
    grafana_version: config.buildInfo.version,
  };
}

export function reportMetricsSidebarInteraction(
  interactionName: string,
  exploreId: string,
  datasourceType?: string | null,
  properties?: Record<string, unknown>
) {
  reportInteraction(interactionName, {
    ...getMetricsSidebarInteractionProps(exploreId, datasourceType),
    ...properties,
  });
}
