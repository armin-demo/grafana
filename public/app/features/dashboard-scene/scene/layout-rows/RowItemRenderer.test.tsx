import { screen } from '@testing-library/react';
import { render, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { SceneTimeRange } from '@grafana/scenes';

import { DashboardInteractions } from '../../utils/interactions';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

jest.mock('../../utils/interactions', () => ({
  ...jest.requireActual('../../utils/interactions'),
  DashboardInteractions: {
    trackSectionNavigated: jest.fn(),
  },
}));

function renderRow({ collapse = false, title = 'My row' } = {}) {
  const row = new RowItem({
    key: 'row-1',
    title,
    collapse,
    layout: AutoGridLayoutManager.createEmpty(),
  });
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: new RowsLayoutManager({ rows: [row] }),
  });
  render(<scene.Component model={scene} />);
  return { row };
}

describe('RowItemRenderer', () => {
  beforeEach(() => {
    jest.mocked(DashboardInteractions.trackSectionNavigated).mockClear();
  });

  it('exposes aria-expanded=true on the toggle button when the row is expanded', () => {
    const { row } = renderRow({ collapse: false });

    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('exposes aria-expanded=false on the toggle button when the row is collapsed', () => {
    const { row } = renderRow({ collapse: true });

    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('updates aria-expanded when the row is toggled', async () => {
    const { row } = renderRow({ collapse: false });
    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('tracks a collapse_row interaction when collapsing an expanded row', async () => {
    const { row } = renderRow({ collapse: false });
    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));

    await userEvent.click(toggle);

    expect(DashboardInteractions.trackSectionNavigated).toHaveBeenCalledWith({
      item: 'row',
      action: 'collapse_row',
      isEditing: false,
    });
  });

  it('tracks an expand_row interaction when expanding a collapsed row', async () => {
    const { row } = renderRow({ collapse: true });
    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));

    await userEvent.click(toggle);

    expect(DashboardInteractions.trackSectionNavigated).toHaveBeenCalledWith({
      item: 'row',
      action: 'expand_row',
      isEditing: false,
    });
  });
});
