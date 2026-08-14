import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

import { type DashboardPlan } from './types';

const GRAFANA_RANDOM_WALK: DataSourceRef = { type: 'grafana', uid: '-- Grafana --' };

const GRID_COLUMNS = 24;
const PANEL_WIDTH = 12;
const PANEL_HEIGHT = 8;
const ROW_HEADER_HEIGHT = 1;

interface BuiltTarget {
  refId: string;
  datasource: DataSourceRef;
  queryType?: string;
  scenarioId?: string;
}

interface BuiltPanel {
  id: number;
  type: string;
  title: string;
  gridPos: { h: number; w: number; x: number; y: number };
  collapsed?: boolean;
  datasource?: DataSourceRef;
  targets?: BuiltTarget[];
  fieldConfig?: { defaults: Record<string, unknown>; overrides: unknown[] };
  options?: Record<string, unknown>;
}

/**
 * Builds a query target for generated panels. When a datasource is provided,
 * panels are wired to it (TestData uses the random_walk scenario). When none
 * is provided, fall back to the built-in Grafana random walk so the dashboard
 * still renders immediately.
 */
function buildTarget(dsRef: DataSourceRef | undefined): BuiltTarget {
  if (!dsRef) {
    return { refId: 'A', datasource: GRAFANA_RANDOM_WALK, queryType: 'randomWalk' };
  }
  if (dsRef.type === 'grafana-testdata-datasource' || dsRef.type === 'testdata') {
    return { refId: 'A', datasource: dsRef, scenarioId: 'random_walk' };
  }
  return { refId: 'A', datasource: dsRef };
}

export function convertPlanToDashboard(plan: DashboardPlan, dsRef?: DataSourceRef): Record<string, unknown> {
  const panels: BuiltPanel[] = [];
  const target = buildTarget(dsRef);
  let panelId = 1;
  let y = 0;

  for (const section of plan.sections) {
    panels.push({
      id: panelId++,
      type: 'row',
      title: section.title,
      collapsed: false,
      gridPos: { h: ROW_HEADER_HEIGHT, w: GRID_COLUMNS, x: 0, y },
    });
    y += ROW_HEADER_HEIGHT;

    section.panels.forEach((panel, index) => {
      const column = index % 2;
      const rowInSection = Math.floor(index / 2);
      // `text` panels have no query; other visualizations get a datasource target.
      const isTextPanel = panel.vizType === 'text';
      panels.push({
        id: panelId++,
        type: panel.vizType,
        title: panel.title,
        gridPos: {
          h: PANEL_HEIGHT,
          w: PANEL_WIDTH,
          x: column * PANEL_WIDTH,
          y: y + rowInSection * PANEL_HEIGHT,
        },
        datasource: isTextPanel ? undefined : target.datasource,
        targets: isTextPanel ? undefined : [target],
        fieldConfig: { defaults: {}, overrides: [] },
        options: {},
      });
    });

    const rowsUsed = Math.ceil(section.panels.length / 2);
    y += rowsUsed * PANEL_HEIGHT;
  }

  return {
    title: plan.title.trim() || 'New dashboard',
    tags: ['dashboard-plan'],
    editable: true,
    schemaVersion: 41,
    panels,
  };
}

export interface CreateDashboardResult {
  uid: string;
  url: string;
}

export async function createDashboardFromPlan(
  plan: DashboardPlan,
  datasourceUid?: string
): Promise<CreateDashboardResult> {
  const instanceSettings = datasourceUid ? getDataSourceSrv().getInstanceSettings(datasourceUid) : undefined;
  const dsRef: DataSourceRef | undefined = instanceSettings
    ? { type: instanceSettings.type, uid: instanceSettings.uid }
    : undefined;

  const dashboard = convertPlanToDashboard(plan, dsRef);

  const response = await getBackendSrv().post<CreateDashboardResult>('/api/dashboards/db', {
    dashboard,
    overwrite: false,
  });

  return response;
}
