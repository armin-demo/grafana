import { render, screen, waitFor } from 'test/test-utils';
import userEvent from '@testing-library/user-event';

import { getDataSourceSrv } from '@grafana/runtime';

import { HostedMetricsStatsCard } from './HostedMetricsStatsCard';
import { fetchHostedMetricsStats } from './fetchHostedMetricsStats';

jest.mock('./fetchHostedMetricsStats', () => ({
  fetchHostedMetricsStats: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

const fetchHostedMetricsStatsMock = fetchHostedMetricsStats as jest.MockedFunction<typeof fetchHostedMetricsStats>;

describe('HostedMetricsStatsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDataSourceSrv as jest.Mock).mockReturnValue({ getList: () => [] });
  });

  it('renders active series and DPM when stats are available', async () => {
    fetchHostedMetricsStatsMock.mockResolvedValue({
      activeSeries: 4_200_000,
      dpm: 12_500,
      datasourceUid: 'prom-1',
      datasourceName: 'Prometheus',
    });

    render(<HostedMetricsStatsCard />);

    expect(await screen.findByRole('heading', { name: /hosted metrics/i })).toBeInTheDocument();
    expect(await screen.findByText(/active series/i)).toBeInTheDocument();
    expect(screen.getByText(/data points \/ min/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view metrics/i })).toHaveAttribute(
      'href',
      '/a/grafana-metricsdrilldown-app'
    );
    expect(screen.getByText('Prometheus')).toBeInTheDocument();
  });

  it('shows an add-datasource CTA when no metrics datasource exists', async () => {
    fetchHostedMetricsStatsMock.mockResolvedValue({
      activeSeries: null,
      dpm: null,
      datasourceUid: null,
      datasourceName: null,
    });

    render(<HostedMetricsStatsCard />);

    expect(
      await screen.findByText(/connect a metrics data source to see active series and data points per minute/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add data source/i })).toHaveAttribute('href', '/connections/datasources');
  });

  it('shows an empty state when the datasource has no series/DPM metrics', async () => {
    fetchHostedMetricsStatsMock.mockResolvedValue({
      activeSeries: null,
      dpm: null,
      datasourceUid: 'prom-1',
      datasourceName: 'Prometheus',
    });

    render(<HostedMetricsStatsCard />);

    expect(await screen.findByText(/no active series or dpm metrics were found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explore metrics/i })).toBeInTheDocument();
  });

  it('shows a retryable error when the fetch rejects', async () => {
    const user = userEvent.setup();
    fetchHostedMetricsStatsMock.mockRejectedValue(new Error('network down'));

    render(<HostedMetricsStatsCard />);

    expect(await screen.findByText(/could not load hosted metrics stats/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    fetchHostedMetricsStatsMock.mockResolvedValue({
      activeSeries: 100,
      dpm: 50,
      datasourceUid: 'prom-1',
      datasourceName: 'Prometheus',
    });

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText(/active series/i)).toBeInTheDocument();
    });
  });
});
