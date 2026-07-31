import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';

import { fetchHostedMetricsStats, pickMetricsDatasourceUid } from './fetchHostedMetricsStats';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  getDataSourceSrv: jest.fn(),
}));

const getBackendSrvMock = getBackendSrv as jest.MockedFunction<typeof getBackendSrv>;
const getDataSourceSrvMock = getDataSourceSrv as jest.MockedFunction<typeof getDataSourceSrv>;

describe('pickMetricsDatasourceUid', () => {
  it('returns null when no metrics datasources exist', () => {
    getDataSourceSrvMock.mockReturnValue({
      getList: () => [],
    } as ReturnType<typeof getDataSourceSrv>);

    expect(pickMetricsDatasourceUid()).toBeNull();
  });

  it('prefers grafanacloud-usage over the default hosted Prometheus datasource', () => {
    getDataSourceSrvMock.mockReturnValue({
      getList: () => [
        { uid: 'grafanacloud-prom', name: 'grafanacloud-prom', type: 'prometheus', isDefault: true },
        { uid: 'grafanacloud-usage', name: 'grafanacloud-usage', type: 'prometheus', isDefault: false },
      ],
    } as ReturnType<typeof getDataSourceSrv>);

    expect(pickMetricsDatasourceUid()).toEqual({ uid: 'grafanacloud-usage', name: 'grafanacloud-usage' });
  });

  it('prefers a default Prometheus datasource over a non-Prometheus default', () => {
    getDataSourceSrvMock.mockReturnValue({
      getList: () => [
        { uid: 'cw', name: 'CloudWatch', type: 'cloudwatch', isDefault: true },
        { uid: 'prom-a', name: 'Prometheus A', type: 'prometheus', isDefault: false },
      ],
    } as ReturnType<typeof getDataSourceSrv>);

    expect(pickMetricsDatasourceUid()).toEqual({ uid: 'prom-a', name: 'Prometheus A' });
  });

  it('prefers the default Prometheus datasource among Prometheus sources', () => {
    getDataSourceSrvMock.mockReturnValue({
      getList: () => [
        { uid: 'prom-a', name: 'Prometheus A', type: 'prometheus', isDefault: false },
        { uid: 'prom-b', name: 'Prometheus B', type: 'prometheus', isDefault: true },
      ],
    } as ReturnType<typeof getDataSourceSrv>);

    expect(pickMetricsDatasourceUid()).toEqual({ uid: 'prom-b', name: 'Prometheus B' });
  });

  it('returns null when only non-Prometheus metrics datasources exist', () => {
    getDataSourceSrvMock.mockReturnValue({
      getList: () => [{ uid: 'cw', name: 'CloudWatch', type: 'cloudwatch', isDefault: true }],
    } as ReturnType<typeof getDataSourceSrv>);

    expect(pickMetricsDatasourceUid()).toBeNull();
  });
});

describe('fetchHostedMetricsStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null stats when no metrics datasource is configured', async () => {
    getDataSourceSrvMock.mockReturnValue({
      getList: () => [],
    } as ReturnType<typeof getDataSourceSrv>);

    await expect(fetchHostedMetricsStats()).resolves.toEqual({
      activeSeries: null,
      dpm: null,
      datasourceUid: null,
      datasourceName: null,
    });
  });

  it('loads active series and DPM from Prometheus instant queries', async () => {
    getDataSourceSrvMock.mockReturnValue({
      getList: () => [{ uid: 'prom-1', name: 'Prometheus', type: 'prometheus', isDefault: true }],
    } as ReturnType<typeof getDataSourceSrv>);

    const get = jest.fn(async (_url: string, params: { query: string }) => {
      if (params.query.includes('active_series') || params.query.includes('head_series')) {
        return { status: 'success', data: { resultType: 'vector', result: [{ value: [1, '4200000'] }] } };
      }
      if (params.query.includes('samples')) {
        return { status: 'success', data: { resultType: 'vector', result: [{ value: [1, '12500'] }] } };
      }
      return { status: 'success', data: { resultType: 'vector', result: [] } };
    });
    getBackendSrvMock.mockReturnValue({ get } as unknown as ReturnType<typeof getBackendSrv>);

    await expect(fetchHostedMetricsStats()).resolves.toEqual({
      activeSeries: 4_200_000,
      dpm: 12_500,
      datasourceUid: 'prom-1',
      datasourceName: 'Prometheus',
    });
  });
});
