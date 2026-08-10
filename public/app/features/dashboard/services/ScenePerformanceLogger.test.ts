import { store } from '@grafana/data';
import { type performanceUtils } from '@grafana/scenes';

import { ScenePerformanceLogger } from './ScenePerformanceLogger';

const SCENE_PROFILING_KEY = 'grafana.debug.sceneProfiling';

function panelOp(operation: performanceUtils.PanelPerformanceData['operation']): performanceUtils.PanelPerformanceData {
  return {
    panelId: '1',
    panelKey: 'panel-1',
    pluginId: 'timeseries',
    operation,
    metadata: {
      queryId: 'q1',
      queryType: 'range',
      transformationId: 'reduce',
      success: true,
      pluginId: 'timeseries',
    },
    operationId: 'op-1',
    timestamp: 0,
    duration: 10,
  } as unknown as performanceUtils.PanelPerformanceData;
}

function dashboardComplete(): performanceUtils.DashboardInteractionCompleteData {
  return {
    interactionType: 'dashboard_view',
    operationId: 'op-1',
    timestamp: 0,
    duration: 100,
    networkDuration: 0,
    longFramesCount: 0,
    longFramesTotalTime: 0,
  } as unknown as performanceUtils.DashboardInteractionCompleteData;
}

describe('ScenePerformanceLogger', () => {
  let logger: ScenePerformanceLogger;
  let markSpy: jest.SpyInstance;
  let measureSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new ScenePerformanceLogger();
    markSpy = jest.spyOn(performance, 'mark').mockImplementation(() => ({}) as PerformanceMark);
    measureSpy = jest.spyOn(performance, 'measure').mockReturnValue({ duration: 0 } as PerformanceMeasure);
  });

  afterEach(() => {
    store.delete(SCENE_PROFILING_KEY);
    jest.restoreAllMocks();
  });

  it('does not emit DevTools marks or measures when scene profiling debug is disabled', () => {
    store.delete(SCENE_PROFILING_KEY);

    logger.onDashboardInteractionStart({
      interactionType: 'dashboard_view',
      operationId: 'op-1',
      timestamp: 0,
    } as unknown as performanceUtils.DashboardInteractionStartData);
    logger.onPanelOperationStart(panelOp('render'));
    logger.onPanelOperationComplete(panelOp('render'));
    logger.onDashboardInteractionComplete(dashboardComplete());

    expect(markSpy).not.toHaveBeenCalled();
    expect(measureSpy).not.toHaveBeenCalled();
  });

  it('emits DevTools marks and measures when scene profiling debug is enabled', () => {
    store.set(SCENE_PROFILING_KEY, 'true');
    // Enabling scene profiling also enables console debug logging from writePerformanceLog.
    jest.spyOn(console, 'log').mockImplementation(() => {});

    logger.onPanelOperationStart(panelOp('render'));
    logger.onPanelOperationComplete(panelOp('render'));

    expect(markSpy).toHaveBeenCalled();
    expect(measureSpy).toHaveBeenCalled();
  });
});
