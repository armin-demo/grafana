import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import { Provider } from 'react-redux';
// eslint-disable-next-line no-restricted-imports
import { Router } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { render } from 'test/test-utils';

import { store } from '@grafana/data';
import {
  HistoryWrapper,
  LocationServiceProvider,
  locationService,
  reportInteraction,
  setChromeHeaderHeightHook,
  setLocationService,
} from '@grafana/runtime';
import { getTestFeatureFlagClient } from '@grafana/test-utils/unstable';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { ModalsContextProvider } from 'app/core/context/ModalsContextProvider';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { getRecentlyViewedDashboards } from 'app/features/browse-dashboards/api/recentlyViewed';
import { configureStore } from 'app/store/configureStore';

import { LastViewedDashboardButton } from './LastViewedDashboardButton';

jest.mock('app/features/browse-dashboards/api/recentlyViewed', () => ({
  getRecentlyViewedDashboards: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const mockGetRecentlyViewedDashboards = jest.mocked(getRecentlyViewedDashboards);
const mockReportInteraction = jest.mocked(reportInteraction);

// Only the fields the button reads are relevant here.
const dashboard = { uid: 'abc', name: 'My dashboard', url: '/d/abc/my-dashboard' };

function setTopImpressionUid(uid: string | undefined) {
  store.set(impressionSrv.impressionKey(), JSON.stringify(uid ? [uid] : []));
}

describe('LastViewedDashboardButton', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    contextSrv.user.isSignedIn = true;
    setTopImpressionUid(dashboard.uid);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    mockGetRecentlyViewedDashboards.mockResolvedValue([dashboard] as Awaited<
      ReturnType<typeof getRecentlyViewedDashboards>
    >);
  });

  afterEach(() => {
    store.delete(impressionSrv.impressionKey());
  });

  it('renders a button linking to the most recently viewed dashboard', async () => {
    render(<LastViewedDashboardButton />);

    const button = await screen.findByRole('button', { name: /last viewed dashboard/i });
    expect(button).toBeInTheDocument();
    expect(mockGetRecentlyViewedDashboards).toHaveBeenCalledWith(1);
  });

  it('navigates to the last viewed dashboard on click', async () => {
    const pushSpy = jest.spyOn(locationService, 'push');
    render(<LastViewedDashboardButton />);

    const button = await screen.findByRole('button', { name: /last viewed dashboard/i });
    await user.click(button);

    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_nav_last_viewed_dashboard_clicked');
    expect(pushSpy).toHaveBeenCalledWith('/d/abc/my-dashboard');
  });

  it('renders nothing when there is no view history', async () => {
    setTopImpressionUid(undefined);
    mockGetRecentlyViewedDashboards.mockResolvedValue([]);
    const { container } = render(<LastViewedDashboardButton />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(mockGetRecentlyViewedDashboards).not.toHaveBeenCalled();
  });

  it('does not query for dashboards when signed out', async () => {
    contextSrv.user.isSignedIn = false;
    const { container } = render(<LastViewedDashboardButton />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(mockGetRecentlyViewedDashboards).not.toHaveBeenCalled();
  });

  it('does not re-query search when the top impression UID is unchanged', async () => {
    const history = createMemoryHistory({ initialEntries: ['/d/abc/my-dashboard'] });
    const testLocationService = new HistoryWrapper(history);
    setLocationService(testLocationService);
    setChromeHeaderHeightHook(() => 40);

    rtlRender(
      <Provider store={configureStore()}>
        <OpenFeatureProvider client={getTestFeatureFlagClient()}>
          <GrafanaContext.Provider value={getGrafanaContextMock()}>
            <Router history={history}>
              <LocationServiceProvider service={testLocationService}>
                <CompatRouter>
                  <ModalsContextProvider>
                    <LastViewedDashboardButton />
                  </ModalsContextProvider>
                </CompatRouter>
              </LocationServiceProvider>
            </Router>
          </GrafanaContext.Provider>
        </OpenFeatureProvider>
      </Provider>
    );

    await screen.findByRole('button', { name: /last viewed dashboard/i });
    expect(mockGetRecentlyViewedDashboards).toHaveBeenCalledTimes(1);

    act(() => {
      history.push('/explore');
    });

    expect(mockGetRecentlyViewedDashboards).toHaveBeenCalledTimes(1);
  });

  it('re-queries search when the top impression UID changes', async () => {
    const nextDashboard = { uid: 'def', name: 'Other dashboard', url: '/d/def/other-dashboard' };
    const history = createMemoryHistory({ initialEntries: ['/d/abc/my-dashboard'] });
    const testLocationService = new HistoryWrapper(history);
    setLocationService(testLocationService);
    setChromeHeaderHeightHook(() => 40);

    rtlRender(
      <Provider store={configureStore()}>
        <OpenFeatureProvider client={getTestFeatureFlagClient()}>
          <GrafanaContext.Provider value={getGrafanaContextMock()}>
            <Router history={history}>
              <LocationServiceProvider service={testLocationService}>
                <CompatRouter>
                  <ModalsContextProvider>
                    <LastViewedDashboardButton />
                  </ModalsContextProvider>
                </CompatRouter>
              </LocationServiceProvider>
            </Router>
          </GrafanaContext.Provider>
        </OpenFeatureProvider>
      </Provider>
    );

    await screen.findByRole('button', { name: /last viewed dashboard/i });
    expect(mockGetRecentlyViewedDashboards).toHaveBeenCalledTimes(1);

    setTopImpressionUid(nextDashboard.uid);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    mockGetRecentlyViewedDashboards.mockResolvedValue([nextDashboard] as Awaited<
      ReturnType<typeof getRecentlyViewedDashboards>
    >);

    act(() => {
      history.push('/d/def/other-dashboard');
    });

    await waitFor(() => {
      expect(mockGetRecentlyViewedDashboards).toHaveBeenCalledTimes(2);
    });
  });
});
