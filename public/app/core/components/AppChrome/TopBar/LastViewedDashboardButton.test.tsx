import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { locationService, reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getRecentlyViewedDashboards } from 'app/features/browse-dashboards/api/recentlyViewed';

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

describe('LastViewedDashboardButton', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    contextSrv.user.isSignedIn = true;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    mockGetRecentlyViewedDashboards.mockResolvedValue([dashboard] as Awaited<
      ReturnType<typeof getRecentlyViewedDashboards>
    >);
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
    mockGetRecentlyViewedDashboards.mockResolvedValue([]);
    const { container } = render(<LastViewedDashboardButton />);

    await waitFor(() => {
      expect(mockGetRecentlyViewedDashboards).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('does not query for dashboards when signed out', async () => {
    contextSrv.user.isSignedIn = false;
    const { container } = render(<LastViewedDashboardButton />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(mockGetRecentlyViewedDashboards).not.toHaveBeenCalled();
  });
});
