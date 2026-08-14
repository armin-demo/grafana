export type PlanLayout = 'tabs' | 'rows';

export type PlanVizType = 'timeseries' | 'stat' | 'gauge' | 'bargauge' | 'barchart' | 'piechart' | 'table' | 'text';

export interface PlanPanel {
  id: string;
  title: string;
  vizType: PlanVizType;
}

export interface PlanSection {
  id: string;
  title: string;
  panels: PlanPanel[];
}

export interface DashboardPlan {
  title: string;
  layout: PlanLayout;
  sections: PlanSection[];
}

export type MoveDirection = 'up' | 'down';
