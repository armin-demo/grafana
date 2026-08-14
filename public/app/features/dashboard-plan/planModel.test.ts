import {
  addPanel,
  addSection,
  countPanels,
  createDefaultPlan,
  createPanel,
  createSection,
  movePanel,
  moveSection,
  removePanel,
  removeSection,
  renamePanel,
  renameSection,
  setLayout,
  setPanelVizType,
  setTitle,
} from './planModel';
import { type DashboardPlan } from './types';

function makePlan(): DashboardPlan {
  return {
    title: 'Plan',
    layout: 'tabs',
    sections: [
      { ...createSection('A', [createPanel('stat', 'A1'), createPanel('timeseries', 'A2')]) },
      { ...createSection('B', [createPanel('gauge', 'B1')]) },
    ],
  };
}

describe('planModel', () => {
  it('creates a default plan with sections and panels', () => {
    const plan = createDefaultPlan();
    expect(plan.sections.length).toBeGreaterThan(0);
    expect(countPanels(plan)).toBeGreaterThan(0);
    expect(plan.layout).toBe('tabs');
  });

  it('generates unique ids for panels and sections', () => {
    const p1 = createPanel();
    const p2 = createPanel();
    expect(p1.id).not.toBe(p2.id);
    const s1 = createSection('x');
    const s2 = createSection('x');
    expect(s1.id).not.toBe(s2.id);
  });

  it('setTitle and setLayout update the plan immutably', () => {
    const plan = makePlan();
    const titled = setTitle(plan, 'New');
    expect(titled.title).toBe('New');
    expect(plan.title).toBe('Plan');

    const asRows = setLayout(plan, 'rows');
    expect(asRows.layout).toBe('rows');
    expect(plan.layout).toBe('tabs');
  });

  it('adds and removes sections', () => {
    const plan = makePlan();
    const added = addSection(plan, 'C');
    expect(added.sections.map((s) => s.title)).toEqual(['A', 'B', 'C']);

    const removed = removeSection(added, added.sections[0].id);
    expect(removed.sections.map((s) => s.title)).toEqual(['B', 'C']);
  });

  it('renames a section', () => {
    const plan = makePlan();
    const renamed = renameSection(plan, plan.sections[1].id, 'Renamed');
    expect(renamed.sections[1].title).toBe('Renamed');
  });

  it('moves sections and is a no-op at the boundaries', () => {
    const plan = makePlan();
    const down = moveSection(plan, plan.sections[0].id, 'down');
    expect(down.sections.map((s) => s.title)).toEqual(['B', 'A']);

    const noop = moveSection(plan, plan.sections[0].id, 'up');
    expect(noop.sections.map((s) => s.title)).toEqual(['A', 'B']);
  });

  it('adds, removes, renames and re-types panels', () => {
    const plan = makePlan();
    const sectionId = plan.sections[0].id;

    const added = addPanel(plan, sectionId, 'table');
    expect(added.sections[0].panels).toHaveLength(3);
    expect(added.sections[0].panels[2].vizType).toBe('table');

    const panelId = added.sections[0].panels[0].id;
    const renamed = renamePanel(added, sectionId, panelId, 'Renamed panel');
    expect(renamed.sections[0].panels[0].title).toBe('Renamed panel');

    const retyped = setPanelVizType(renamed, sectionId, panelId, 'piechart');
    expect(retyped.sections[0].panels[0].vizType).toBe('piechart');

    const removed = removePanel(retyped, sectionId, panelId);
    expect(removed.sections[0].panels).toHaveLength(2);
    expect(removed.sections[0].panels.find((p) => p.id === panelId)).toBeUndefined();
  });

  it('moves panels within a section and is a no-op at the boundaries', () => {
    const plan = makePlan();
    const sectionId = plan.sections[0].id;
    const [first, second] = plan.sections[0].panels;

    const moved = movePanel(plan, sectionId, first.id, 'down');
    expect(moved.sections[0].panels.map((p) => p.id)).toEqual([second.id, first.id]);

    const noop = movePanel(plan, sectionId, first.id, 'up');
    expect(noop.sections[0].panels.map((p) => p.id)).toEqual([first.id, second.id]);
  });

  it('counts panels across all sections', () => {
    expect(countPanels(makePlan())).toBe(3);
  });
});
