import { reportInteraction } from '@grafana/runtime';

import { countPanels } from './planModel';
import { type DashboardPlan, type MoveDirection, type PlanLayout, type PlanVizType } from './types';

const PREFIX = 'dashboard_plan';

function report(name: string, properties: Record<string, unknown> = {}) {
  reportInteraction(`${PREFIX}_${name}`, properties);
}

export const dashboardPlanTracking = {
  opened(plan: DashboardPlan, datasourceUid?: string) {
    report('opened', {
      datasource_uid: datasourceUid ?? '',
      layout: plan.layout,
      section_count: plan.sections.length,
      panel_count: countPanels(plan),
    });
  },
  layoutSwitched(layout: PlanLayout) {
    report('layout_switched', { layout });
  },
  tabSwitched(index: number) {
    report('tab_switched', { index });
  },
  sectionAdded(sectionCount: number) {
    report('section_added', { section_count: sectionCount });
  },
  sectionRemoved(sectionCount: number) {
    report('section_removed', { section_count: sectionCount });
  },
  sectionMoved(direction: MoveDirection) {
    report('section_moved', { direction });
  },
  panelAdded(vizType: PlanVizType) {
    report('panel_added', { viz_type: vizType });
  },
  panelRemoved() {
    report('panel_removed');
  },
  panelMoved(direction: MoveDirection) {
    report('panel_moved', { direction });
  },
  panelVizChanged(vizType: PlanVizType) {
    report('panel_viz_changed', { viz_type: vizType });
  },
  buildClicked(plan: DashboardPlan, datasourceUid?: string) {
    report('build_clicked', {
      datasource_uid: datasourceUid ?? '',
      layout: plan.layout,
      section_count: plan.sections.length,
      panel_count: countPanels(plan),
    });
  },
  buildSucceeded(uid: string) {
    report('build_succeeded', { uid });
  },
  buildFailed() {
    report('build_failed');
  },
};
