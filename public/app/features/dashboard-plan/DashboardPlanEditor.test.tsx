import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { locationUtil } from '@grafana/data';

import { DashboardPlanEditor } from './DashboardPlanEditor';

const reportInteraction = jest.fn();
const push = jest.fn();
const createDashboardFromPlan = jest.fn();

jest.mock('@grafana/runtime', () => ({
  reportInteraction: (name: string, props: Record<string, unknown>) => reportInteraction(name, props),
  locationService: { push: (url: string) => push(url) },
}));

jest.mock('./buildDashboard', () => ({
  createDashboardFromPlan: (...args: unknown[]) => createDashboardFromPlan(...args),
}));

jest.mock('app/types/store', () => ({
  useDispatch: () => jest.fn(),
}));

jest.mock('app/core/reducers/appNotification', () => ({
  notifyApp: jest.fn((n) => ({ type: 'notifyApp', payload: n })),
}));

jest.mock('app/core/copy/appNotification', () => ({
  createErrorNotification: jest.fn((message) => ({ severity: 'error', text: message })),
}));

function interactionNames() {
  return reportInteraction.mock.calls.map((c) => c[0]);
}

describe('DashboardPlanEditor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports an opened interaction on mount with the datasource', () => {
    render(<DashboardPlanEditor datasourceUid="ds-1" />);
    expect(reportInteraction).toHaveBeenCalledWith(
      'dashboard_plan_opened',
      expect.objectContaining({ datasource_uid: 'ds-1', layout: 'tabs' })
    );
  });

  it('tracks switching between tabs and rows layouts', () => {
    render(<DashboardPlanEditor />);
    fireEvent.click(screen.getByRole('radio', { name: 'Rows' }));
    expect(reportInteraction).toHaveBeenCalledWith('dashboard_plan_layout_switched', { layout: 'rows' });
  });

  it('tracks adding a section', () => {
    render(<DashboardPlanEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add tab' }));
    expect(interactionNames()).toContain('dashboard_plan_section_added');
  });

  it('tracks adding a panel', () => {
    render(<DashboardPlanEditor />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add panel' })[0]);
    expect(reportInteraction).toHaveBeenCalledWith('dashboard_plan_panel_added', { viz_type: 'timeseries' });
  });

  it('builds the dashboard and navigates to it', async () => {
    createDashboardFromPlan.mockResolvedValue({ uid: 'new-uid', url: '/d/new-uid/plan' });
    render(<DashboardPlanEditor datasourceUid="ds-1" />);

    fireEvent.click(screen.getByTestId('dashboard-plan-build'));

    expect(reportInteraction).toHaveBeenCalledWith('dashboard_plan_build_clicked', expect.any(Object));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/d/new-uid/plan'));
    expect(reportInteraction).toHaveBeenCalledWith('dashboard_plan_build_succeeded', { uid: 'new-uid' });
  });

  it('strips appSubUrl before navigating to the built dashboard', async () => {
    const strip = jest.spyOn(locationUtil, 'stripBaseFromUrl').mockReturnValue('/d/new-uid/plan');
    try {
      createDashboardFromPlan.mockResolvedValue({ uid: 'new-uid', url: '/grafana/d/new-uid/plan' });
      render(<DashboardPlanEditor />);

      fireEvent.click(screen.getByTestId('dashboard-plan-build'));

      await waitFor(() => expect(push).toHaveBeenCalledWith('/d/new-uid/plan'));
      expect(strip).toHaveBeenCalledWith('/grafana/d/new-uid/plan');
    } finally {
      strip.mockRestore();
    }
  });
});
