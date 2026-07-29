import { reportInteraction } from '@grafana/runtime';

import { getMetricsSidebarInteractionProps, reportMetricsSidebarInteraction } from './analytics';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    buildInfo: {
      ...jest.requireActual('@grafana/runtime').config.buildInfo,
      version: '12.0.0-test',
    },
  },
}));

describe('MetricsSidebar analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds shared interaction properties', () => {
    expect(getMetricsSidebarInteractionProps('left', 'prometheus')).toEqual({
      exploreId: 'left',
      datasourceType: 'prometheus',
      grafana_version: '12.0.0-test',
    });
  });

  it('defaults missing datasource type to unknown', () => {
    expect(getMetricsSidebarInteractionProps('right')).toEqual({
      exploreId: 'right',
      datasourceType: 'unknown',
      grafana_version: '12.0.0-test',
    });
  });

  it('reports interactions with shared and custom properties', () => {
    reportMetricsSidebarInteraction('explore_metrics_sidebar_viewed', 'left', 'prometheus', {
      metricCount: 12,
    });

    expect(reportInteraction).toHaveBeenCalledWith('explore_metrics_sidebar_viewed', {
      exploreId: 'left',
      datasourceType: 'prometheus',
      grafana_version: '12.0.0-test',
      metricCount: 12,
    });
  });
});
