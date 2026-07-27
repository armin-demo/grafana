import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Props as AutoSizerProps } from 'react-virtualized-auto-sizer';
import { Provider } from 'react-redux';

import { type DataQuery, type DataSourceApi, getDefaultTimeRange } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';
import { type ExploreState } from 'app/types/explore';

import { makeExplorePaneState } from '../state/utils';

import {
  findTargetQueryIndex,
  MetricsSidebar,
  type QueryWithExpr,
} from './MetricsSidebar';
import {
  isPrometheusCompatibleDatasource,
  type MetricsLanguageProvider,
} from './isPrometheusCompatibleDatasource';

const mockChangeQueries = jest.fn((_args: { exploreId: string; queries: DataQuery[] }) => ({
  type: 'explore/changeQueries',
}));
const mockRunQueries = jest.fn((_args: { exploreId: string }) => ({ type: 'explore/runQueries' }));
const mockReportInteraction = jest.fn();

jest.mock('../state/query', () => ({
  ...jest.requireActual('../state/query'),
  changeQueries: (args: { exploreId: string; queries: DataQuery[] }) => mockChangeQueries(args),
  runQueries: (args: { exploreId: string }) => mockRunQueries(args),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: (...args: unknown[]) => mockReportInteraction(...args),
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: AutoSizerProps) =>
    children({
      height: 400,
      scaledHeight: 400,
      scaledWidth: 280,
      width: 280,
    });
});

function createLanguageProvider(overrides?: Partial<MetricsLanguageProvider>): MetricsLanguageProvider {
  return {
    start: jest.fn().mockResolvedValue([]),
    retrieveMetrics: jest.fn().mockReturnValue(['go_goroutines', 'http_requests_total', 'process_cpu_seconds_total']),
    retrieveMetricsMetadata: jest.fn().mockReturnValue({
      go_goroutines: { type: 'gauge', help: 'Number of goroutines' },
      http_requests_total: { type: 'counter', help: 'Total HTTP requests' },
    }),
    ...overrides,
  };
}

function createPrometheusDatasource(languageProvider: MetricsLanguageProvider): DataSourceApi {
  return {
    uid: 'prom',
    name: 'Prometheus',
    type: 'prometheus',
    meta: { mixed: false },
    languageProvider,
    getRef: () => ({ type: 'prometheus', uid: 'prom' }),
  } as unknown as DataSourceApi;
}

function setup(
  options: {
    queries?: QueryWithExpr[];
    languageProvider?: MetricsLanguageProvider;
    datasource?: DataSourceApi | null;
  } = {}
) {
  const languageProvider = options.languageProvider ?? createLanguageProvider();
  const datasourceInstance =
    options.datasource === null
      ? null
      : (options.datasource ?? createPrometheusDatasource(languageProvider));

  const store = configureStore({
    explore: {
      panes: {
        left: makeExplorePaneState({
          datasourceInstance,
          range: getDefaultTimeRange(),
          queries: options.queries ?? [{ refId: 'A', expr: '' }],
        }),
      },
    } as unknown as ExploreState,
  });

  render(
    <Provider store={store}>
      <MetricsSidebar exploreId="left" />
    </Provider>
  );

  return { languageProvider, store };
}

describe('findTargetQueryIndex', () => {
  it('returns the first query with an empty expr', () => {
    expect(
      findTargetQueryIndex([
        { refId: 'A', expr: 'up' },
        { refId: 'B', expr: '' },
        { refId: 'C', expr: 'rate(foo[5m])' },
      ])
    ).toBe(1);
  });

  it('returns the last query when all have expr', () => {
    expect(
      findTargetQueryIndex([
        { refId: 'A', expr: 'up' },
        { refId: 'B', expr: 'rate(foo[5m])' },
      ])
    ).toBe(1);
  });

  it('returns -1 for an empty query list', () => {
    expect(findTargetQueryIndex([])).toBe(-1);
  });

  it('treats missing expr as empty', () => {
    expect(findTargetQueryIndex([{ refId: 'A' }, { refId: 'B', expr: 'up' }])).toBe(0);
  });
});

describe('isPrometheusCompatibleDatasource', () => {
  it('returns true for datasources with a metrics language provider', () => {
    expect(isPrometheusCompatibleDatasource(createPrometheusDatasource(createLanguageProvider()))).toBe(true);
  });

  it('returns false for mixed datasources', () => {
    const ds = createPrometheusDatasource(createLanguageProvider());
    (ds.meta as { mixed: boolean }).mixed = true;
    expect(isPrometheusCompatibleDatasource(ds)).toBe(false);
  });

  it('returns false when language provider is missing retrieveMetrics', () => {
    const ds = {
      uid: 'loki',
      type: 'loki',
      meta: { mixed: false },
      languageProvider: { start: jest.fn() },
    } as unknown as DataSourceApi;
    expect(isPrometheusCompatibleDatasource(ds)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isPrometheusCompatibleDatasource(null)).toBe(false);
    expect(isPrometheusCompatibleDatasource(undefined)).toBe(false);
  });
});

describe('MetricsSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders metrics from the language provider', async () => {
    const languageProvider = createLanguageProvider();
    setup({ languageProvider });

    await waitFor(() => {
      expect(screen.getByTestId('data-testid MetricsSidebar metric-item go_goroutines')).toBeInTheDocument();
    });
    expect(screen.getByTestId('data-testid MetricsSidebar metric-item http_requests_total')).toBeInTheDocument();
    expect(languageProvider.start).toHaveBeenCalled();
    expect(languageProvider.retrieveMetrics).toHaveBeenCalled();
  });

  it('filters metrics via search', async () => {
    const user = userEvent.setup();
    setup();

    await waitFor(() => {
      expect(screen.getByTestId('data-testid MetricsSidebar metric-item go_goroutines')).toBeInTheDocument();
    });

    await user.type(screen.getByTestId('data-testid MetricsSidebar search-input'), 'http');

    expect(screen.queryByTestId('data-testid MetricsSidebar metric-item go_goroutines')).not.toBeInTheDocument();
    expect(screen.getByTestId('data-testid MetricsSidebar metric-item http_requests_total')).toBeInTheDocument();
  });

  it('sets expr on the empty query row and runs queries when a metric is clicked', async () => {
    const user = userEvent.setup();
    setup({
      queries: [
        { refId: 'A', expr: 'up' },
        { refId: 'B', expr: '' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-testid MetricsSidebar metric-item go_goroutines')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('data-testid MetricsSidebar metric-item go_goroutines'));

    expect(mockChangeQueries).toHaveBeenCalledWith({
      exploreId: 'left',
      queries: [
        { refId: 'A', expr: 'up' },
        { refId: 'B', expr: 'go_goroutines' },
      ],
    });
    expect(mockRunQueries).toHaveBeenCalledWith({ exploreId: 'left' });
  });

  it('sets expr on the last query row when all rows have expr', async () => {
    const user = userEvent.setup();
    setup({
      queries: [
        { refId: 'A', expr: 'up' },
        { refId: 'B', expr: 'rate(foo[5m])' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-testid MetricsSidebar metric-item http_requests_total')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('data-testid MetricsSidebar metric-item http_requests_total'));

    expect(mockChangeQueries).toHaveBeenCalledWith({
      exploreId: 'left',
      queries: [
        { refId: 'A', expr: 'up' },
        { refId: 'B', expr: 'http_requests_total' },
      ],
    });
    expect(mockRunQueries).toHaveBeenCalledWith({ exploreId: 'left' });
  });

  it('shows an error state when the language provider fails', async () => {
    const languageProvider = createLanguageProvider({
      start: jest.fn().mockRejectedValue(new Error('network failure')),
    });
    setup({ languageProvider });

    await waitFor(() => {
      expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
    });
    expect(screen.getByText('network failure')).toBeInTheDocument();
  });

  it('shows an empty state when there are no metrics', async () => {
    const languageProvider = createLanguageProvider({
      retrieveMetrics: jest.fn().mockReturnValue([]),
    });
    setup({ languageProvider });

    await waitFor(() => {
      expect(screen.getByText('No metrics found')).toBeInTheDocument();
    });
  });
});
