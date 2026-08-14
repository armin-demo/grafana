import { screen } from '@testing-library/react';
import { render, userEvent } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';

import { DashboardInteractions } from '../../utils/interactions';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

jest.mock('../../utils/interactions', () => ({
  ...jest.requireActual('../../utils/interactions'),
  DashboardInteractions: {
    trackSectionNavigated: jest.fn(),
  },
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function renderTabs() {
  const tabs = [
    new TabItem({ title: 'Tab 1', layout: AutoGridLayoutManager.createEmpty() }),
    new TabItem({ title: 'Tab 2', layout: AutoGridLayoutManager.createEmpty() }),
  ];
  const tabsLayout = new TabsLayoutManager({ tabs });
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: tabsLayout,
  });
  render(<scene.Component model={scene} />);
  return { tabs };
}

describe('TabItemRenderer', () => {
  beforeEach(() => {
    jest.mocked(DashboardInteractions.trackSectionNavigated).mockClear();
  });

  it('tracks a switch_tab interaction when clicking an inactive tab', async () => {
    renderTabs();

    // The first tab is active on initial render, so clicking the second one is a genuine switch.
    await userEvent.click(screen.getByText('Tab 2'));

    expect(DashboardInteractions.trackSectionNavigated).toHaveBeenCalledWith({
      item: 'tab',
      action: 'switch_tab',
      isEditing: false,
    });
  });

  it('does not track a switch when clicking the already-active tab', async () => {
    renderTabs();

    await userEvent.click(screen.getByText('Tab 1'));

    expect(DashboardInteractions.trackSectionNavigated).not.toHaveBeenCalled();
  });
});
