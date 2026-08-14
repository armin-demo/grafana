import { convertPlanToDashboard, createDashboardFromPlan } from './buildDashboard';
import { createPanel, createSection } from './planModel';
import { type DashboardPlan } from './types';

const post = jest.fn();
const getInstanceSettings = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({ post }),
  getDataSourceSrv: () => ({ getInstanceSettings }),
}));

interface BuiltPanel {
  id: number;
  type: string;
  title: string;
  gridPos: { h: number; w: number; x: number; y: number };
  targets?: Array<{ datasource: { type: string; uid: string }; scenarioId?: string; queryType?: string }>;
}

function planWith(layout: DashboardPlan['layout'] = 'tabs'): DashboardPlan {
  return {
    title: 'My plan',
    layout,
    sections: [
      createSection('Overview', [createPanel('stat', 'Total'), createPanel('timeseries', 'Trend')]),
      createSection('Docs', [createPanel('text', 'Notes')]),
    ],
  };
}

describe('convertPlanToDashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates one row header per section and a panel per element', () => {
    const dashboard = convertPlanToDashboard(planWith());
    const panels = dashboard.panels as BuiltPanel[];

    const rows = panels.filter((p) => p.type === 'row');
    expect(rows.map((r) => r.title)).toEqual(['Overview', 'Docs']);

    const nonRows = panels.filter((p) => p.type !== 'row');
    expect(nonRows.map((p) => p.title)).toEqual(['Total', 'Trend', 'Notes']);
    expect(dashboard.title).toBe('My plan');
  });

  it('falls back to a default title when the plan title is blank', () => {
    const plan = planWith();
    plan.title = '   ';
    expect(convertPlanToDashboard(plan).title).toBe('New dashboard');
  });

  it('wires non-text panels to the built-in Grafana random walk by default', () => {
    const panels = convertPlanToDashboard(planWith()).panels as BuiltPanel[];
    const trend = panels.find((p) => p.title === 'Trend');
    expect(trend?.targets?.[0]).toMatchObject({
      datasource: { type: 'grafana', uid: '-- Grafana --' },
      queryType: 'randomWalk',
    });
  });

  it('omits queries for text panels', () => {
    const panels = convertPlanToDashboard(planWith()).panels as BuiltPanel[];
    const notes = panels.find((p) => p.title === 'Notes');
    expect(notes?.targets).toBeUndefined();
  });

  it('uses the random_walk scenario for TestData datasources', () => {
    const panels = convertPlanToDashboard(planWith(), {
      type: 'grafana-testdata-datasource',
      uid: 'testdata-1',
    }).panels as BuiltPanel[];
    const total = panels.find((p) => p.title === 'Total');
    expect(total?.targets?.[0]).toMatchObject({
      datasource: { type: 'grafana-testdata-datasource', uid: 'testdata-1' },
      scenarioId: 'random_walk',
    });
  });
});

describe('createDashboardFromPlan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts the built dashboard and returns the created uid/url', async () => {
    post.mockResolvedValue({ uid: 'abc', url: '/d/abc/my-plan' });

    const result = await createDashboardFromPlan(planWith());

    expect(post).toHaveBeenCalledWith('/api/dashboards/db', expect.objectContaining({ overwrite: false }));
    expect(result).toEqual({ uid: 'abc', url: '/d/abc/my-plan' });
  });

  it('resolves the datasource ref from the provided uid', async () => {
    getInstanceSettings.mockReturnValue({ type: 'grafana-testdata-datasource', uid: 'testdata-1' });
    post.mockResolvedValue({ uid: 'abc', url: '/d/abc' });

    await createDashboardFromPlan(planWith(), 'testdata-1');

    expect(getInstanceSettings).toHaveBeenCalledWith('testdata-1');
    const body = post.mock.calls[0][1];
    const trend = (body.dashboard.panels as BuiltPanel[]).find((p) => p.title === 'Trend');
    expect(trend?.targets?.[0].datasource).toMatchObject({ type: 'grafana-testdata-datasource', uid: 'testdata-1' });
  });
});
