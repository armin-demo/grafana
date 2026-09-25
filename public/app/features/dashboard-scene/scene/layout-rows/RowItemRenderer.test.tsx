import { screen, waitFor } from '@testing-library/react';
import { render, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

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

  it('uses nested title typography for rows inside another row', () => {
    const inner = new RowItem({
      key: 'row-inner',
      title: 'Inner',
      layout: AutoGridLayoutManager.createEmpty(),
    });
    const outer = new RowItem({
      key: 'row-outer',
      title: 'Outer',
      layout: new RowsLayoutManager({ rows: [inner] }),
    });
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: new RowsLayoutManager({ rows: [outer] }),
    });
    render(<scene.Component model={scene} />);

    const outerTitle = screen.getByTestId(selectors.components.DashboardRow.title('Outer'));
    const innerTitle = screen.getByTestId(selectors.components.DashboardRow.title('Inner'));
    expect(outerTitle.className).not.toEqual(innerTitle.className);
  });

  it('uses the same title typography for repeated row clones as the source', async () => {
    const row = new RowItem({
      key: 'row-1',
      title: '$env',
      repeatByVariable: 'env',
      layout: AutoGridLayoutManager.createEmpty(),
    });
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      $variables: new SceneVariableSet({
        variables: [
          new CustomVariable({
            name: 'env',
            query: 'value-one,value-two',
            value: ['value-one', 'value-two'],
            text: ['value-one', 'value-two'],
            isMulti: true,
          }),
        ],
      }),
      body: new RowsLayoutManager({ rows: [row] }),
    });
    render(<scene.Component model={scene} />);

    await waitFor(() => {
      expect(screen.getByTestId(selectors.components.DashboardRow.title('value-one'))).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.DashboardRow.title('value-two'))).toBeInTheDocument();
    });

    const sourceTitle = screen.getByTestId(selectors.components.DashboardRow.title('value-one'));
    const cloneTitle = screen.getByTestId(selectors.components.DashboardRow.title('value-two'));
    expect(sourceTitle.className).toEqual(cloneTitle.className);
  });
});
