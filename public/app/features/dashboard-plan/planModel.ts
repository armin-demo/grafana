import { uniqueId } from 'lodash';

import { t } from '@grafana/i18n';

import { type DashboardPlan, type MoveDirection, type PlanPanel, type PlanSection, type PlanVizType } from './types';

export function createPanel(vizType: PlanVizType = 'timeseries', title?: string): PlanPanel {
  return {
    id: uniqueId('plan-panel-'),
    title: title ?? defaultPanelTitle(vizType),
    vizType,
  };
}

export function createSection(title: string, panels: PlanPanel[] = []): PlanSection {
  return {
    id: uniqueId('plan-section-'),
    title,
    panels,
  };
}

function defaultPanelTitle(vizType: PlanVizType): string {
  const label = vizType.charAt(0).toUpperCase() + vizType.slice(1);
  return `${label} panel`;
}

/**
 * A small starter plan so the editor always opens with something to tweak.
 * The reporter's ask is about *editing* a plan, so an empty canvas would be a
 * poor first experience.
 */
export function createDefaultPlan(): DashboardPlan {
  return {
    title: t('dashboard-plan.default.title', 'New dashboard'),
    layout: 'tabs',
    sections: [
      createSection(t('dashboard-plan.default.overview', 'Overview'), [
        createPanel('stat', t('dashboard-plan.default.total-requests', 'Total requests')),
        createPanel('timeseries', t('dashboard-plan.default.requests-over-time', 'Requests over time')),
      ]),
      createSection(t('dashboard-plan.default.latency', 'Latency'), [
        createPanel('timeseries', t('dashboard-plan.default.p95-latency', 'p95 latency')),
        createPanel('gauge', t('dashboard-plan.default.current-latency', 'Current latency')),
      ]),
    ],
  };
}

function move<T>(items: T[], index: number, direction: MoveDirection): T[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= items.length) {
    return items;
  }
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function setLayout(plan: DashboardPlan, layout: DashboardPlan['layout']): DashboardPlan {
  return { ...plan, layout };
}

export function setTitle(plan: DashboardPlan, title: string): DashboardPlan {
  return { ...plan, title };
}

export function addSection(plan: DashboardPlan, title: string): DashboardPlan {
  return { ...plan, sections: [...plan.sections, createSection(title)] };
}

export function removeSection(plan: DashboardPlan, sectionId: string): DashboardPlan {
  return { ...plan, sections: plan.sections.filter((s) => s.id !== sectionId) };
}

export function renameSection(plan: DashboardPlan, sectionId: string, title: string): DashboardPlan {
  return {
    ...plan,
    sections: plan.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
  };
}

export function moveSection(plan: DashboardPlan, sectionId: string, direction: MoveDirection): DashboardPlan {
  const index = plan.sections.findIndex((s) => s.id === sectionId);
  if (index === -1) {
    return plan;
  }
  return { ...plan, sections: move(plan.sections, index, direction) };
}

export function addPanel(plan: DashboardPlan, sectionId: string, vizType: PlanVizType): DashboardPlan {
  return {
    ...plan,
    sections: plan.sections.map((s) =>
      s.id === sectionId ? { ...s, panels: [...s.panels, createPanel(vizType)] } : s
    ),
  };
}

export function removePanel(plan: DashboardPlan, sectionId: string, panelId: string): DashboardPlan {
  return {
    ...plan,
    sections: plan.sections.map((s) =>
      s.id === sectionId ? { ...s, panels: s.panels.filter((p) => p.id !== panelId) } : s
    ),
  };
}

export function renamePanel(plan: DashboardPlan, sectionId: string, panelId: string, title: string): DashboardPlan {
  return {
    ...plan,
    sections: plan.sections.map((s) =>
      s.id === sectionId
        ? { ...s, panels: s.panels.map((p) => (p.id === panelId ? { ...p, title } : p)) }
        : s
    ),
  };
}

export function setPanelVizType(
  plan: DashboardPlan,
  sectionId: string,
  panelId: string,
  vizType: PlanVizType
): DashboardPlan {
  return {
    ...plan,
    sections: plan.sections.map((s) =>
      s.id === sectionId
        ? { ...s, panels: s.panels.map((p) => (p.id === panelId ? { ...p, vizType } : p)) }
        : s
    ),
  };
}

export function movePanel(
  plan: DashboardPlan,
  sectionId: string,
  panelId: string,
  direction: MoveDirection
): DashboardPlan {
  return {
    ...plan,
    sections: plan.sections.map((s) => {
      if (s.id !== sectionId) {
        return s;
      }
      const index = s.panels.findIndex((p) => p.id === panelId);
      return { ...s, panels: move(s.panels, index, direction) };
    }),
  };
}

export function countPanels(plan: DashboardPlan): number {
  return plan.sections.reduce((total, section) => total + section.panels.length, 0);
}
