import { http, HttpResponse } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import { PluginIncludeType } from '@grafana/data';
import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { type IncidentPreview } from 'app/features/alerting/unified/api/incidentsApi';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { pluginMeta } from 'app/features/alerting/unified/testSetup/plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { AlertState, type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { overviewBarClicked } from '../analytics/main';

import { OverviewBar } from './OverviewBar';
import { HOME_ACTIVE_INCIDENTS_ID, HOME_FIRING_ALERTS_ID } from './constants';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  useIrmPlugin: jest.fn(),
}));

jest.mock('../analytics/main', () => ({
  overviewBarClicked: jest.fn(),
  alertsCardClicked: jest.fn(),
  incidentsCardClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  emptyCtaClicked: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

const mockUseIrmPlugin = jest.mocked(useIrmPlugin);
const QUERY_PREVIEWS_PATH = '/api/plugins/:pluginId/resources/api/v1/IncidentsService.QueryIncidentPreviews';

function makeAlert(overrides: Partial<AlertmanagerAlert> & { labels: AlertmanagerAlert['labels'] }): AlertmanagerAlert {
  return {
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    updatedAt: new Date().toISOString(),
    endsAt: '0001-01-01T00:00:00Z',
    fingerprint: Math.random().toString(36).slice(2),
    receivers: [{ name: 'default' }],
    status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] },
    annotations: {},
    ...overrides,
    labels: { alertname: 'test', ...overrides.labels },
  };
}

function mockTeams(teams: Array<{ name: string }> = []) {
  server.use(
    http.get('/api/user/teams', () =>
      HttpResponse.json(
        teams.map((t, i) => ({ ...t, id: i + 1, uid: `team-${i}`, orgId: 1, memberCount: 1, isProvisioned: false }))
      )
    )
  );
}

function mockAlerts(alerts: AlertmanagerAlert[]) {
  server.use(http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () => HttpResponse.json(alerts)));
}

function mockIncidents(incidents: IncidentPreview[]) {
  server.use(http.post(QUERY_PREVIEWS_PATH, () => HttpResponse.json({ incidentPreviews: incidents })));
}

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
  mockUseIrmPlugin.mockReturnValue({
    pluginId: SupportedPlugin.Incident,
    installed: true,
    loading: false,
    settings: {
      ...pluginMeta[SupportedPlugin.Incident],
      includes: [
        {
          type: PluginIncludeType.page,
          name: 'Incidents',
          path: '/a/grafana-incident-app/incidents',
        },
      ],
    },
  });
  mockTeams([]);
  mockAlerts([]);
  mockIncidents([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('OverviewBar', () => {
  it('renders nothing when the user cannot see alerts and incidents plugin is absent', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.Incident, installed: false, loading: false });

    const { container } = render(<OverviewBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows firing alerts count, severity breakdown, and trend', async () => {
    const now = Date.now();
    mockAlerts([
      makeAlert({
        labels: { alertname: 'CPU Critical', severity: 'critical' },
        startsAt: new Date(now - 60_000).toISOString(),
      }),
      makeAlert({
        labels: { alertname: 'Memory High', severity: 'high' },
        startsAt: new Date(now - 60_000).toISOString(),
      }),
      makeAlert({
        labels: { alertname: 'Disk Warning', severity: 'warning' },
        startsAt: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
      }),
    ]);

    render(<OverviewBar />);

    expect(await screen.findByTestId('home-overview-bar')).toBeInTheDocument();
    expect(screen.getByText('Firing alerts')).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText(/1 critical/i)).toBeInTheDocument();
    expect(screen.getByText(/1 high/i)).toBeInTheDocument();
    // 2 started in last 24h, 1 in prior 24h → +1
    expect(screen.getByText(/\+1 \(24h\)/)).toBeInTheDocument();
  });

  it('shows active incidents count', async () => {
    mockIncidents([
      {
        incidentID: '101',
        title: 'Database outage',
        severityLabel: 'Critical',
        createdTime: '2024-01-02T10:00:00Z',
      },
    ]);

    render(<OverviewBar />);

    expect(await screen.findByText('Active incidents')).toBeInTheDocument();
    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('scrolls to the firing alerts card when the alerts segment is clicked', async () => {
    const target = document.createElement('div');
    target.id = HOME_FIRING_ALERTS_ID;
    const scrollIntoView = jest.fn();
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    render(<OverviewBar />);

    await userEvent.click(await screen.findByTestId('home-overview-bar-alerts'));

    expect(overviewBarClicked).toHaveBeenCalledWith({ segment: 'alerts' });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    target.remove();
  });

  it('scrolls to the incidents card when the incidents segment is clicked', async () => {
    const target = document.createElement('div');
    target.id = HOME_ACTIVE_INCIDENTS_ID;
    const scrollIntoView = jest.fn();
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    render(<OverviewBar />);

    await userEvent.click(await screen.findByTestId('home-overview-bar-incidents'));

    expect(overviewBarClicked).toHaveBeenCalledWith({ segment: 'incidents' });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    target.remove();
  });

  it('hides the alerts segment without AlertingInstanceRead', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIncidents([]);

    render(<OverviewBar />);

    expect(await screen.findByTestId('home-overview-bar-incidents')).toBeInTheDocument();
    expect(screen.queryByTestId('home-overview-bar-alerts')).not.toBeInTheDocument();
  });
});
