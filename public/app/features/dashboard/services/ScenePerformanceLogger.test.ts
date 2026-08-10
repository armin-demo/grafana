import { type performanceUtils } from '@grafana/scenes';

import { ScenePerformanceLogger } from './ScenePerformanceLogger';
import { PERFORMANCE_MARKS } from './performanceConstants';

describe('ScenePerformanceLogger User Timing cleanup', () => {
  let clearMarksSpy: jest.SpyInstance;
  let clearMeasuresSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(performance, 'mark').mockReturnValue({ duration: 0 } as PerformanceMark);
    jest.spyOn(performance, 'measure').mockReturnValue({ duration: 0 } as PerformanceMeasure);
    clearMarksSpy = jest.spyOn(performance, 'clearMarks').mockImplementation(() => {});
    clearMeasuresSpy = jest.spyOn(performance, 'clearMeasures').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears milestone marks and the interaction measure when an interaction completes', () => {
    const logger = new ScenePerformanceLogger();
    const operationId = 'op-1';
    const milestoneMark = PERFORMANCE_MARKS.DASHBOARD_MILESTONE(operationId, 'queries_complete');
    const interactionMeasure = `scenes.dashboard.interaction.duration.${operationId}`;

    logger.onDashboardInteractionStart({
      operationId,
      timestamp: 0,
      interactionType: 'dashboard_view',
    } as performanceUtils.DashboardInteractionStartData);

    logger.onDashboardInteractionMilestone({
      operationId,
      milestone: 'queries_complete',
      timestamp: 5,
    } as performanceUtils.DashboardInteractionMilestoneData);

    logger.onDashboardInteractionComplete({
      operationId,
      timestamp: 10,
      interactionType: 'dashboard_view',
    } as performanceUtils.DashboardInteractionCompleteData);

    // Standalone milestone mark (never paired into a measure) must be cleared on completion.
    expect(clearMarksSpy).toHaveBeenCalledWith(milestoneMark);
    // The interaction measure and its bounding marks are cleared by createPerformanceMeasure.
    expect(clearMeasuresSpy).toHaveBeenCalledWith(interactionMeasure);
  });

  it('does not retain milestone marks across interactions (bounded buffer)', () => {
    const logger = new ScenePerformanceLogger();

    for (let i = 0; i < 5; i++) {
      const operationId = `op-${i}`;
      logger.onDashboardInteractionStart({
        operationId,
        timestamp: 0,
        interactionType: 'refresh',
      } as performanceUtils.DashboardInteractionStartData);
      logger.onDashboardInteractionMilestone({
        operationId,
        milestone: 'actual_interaction_complete',
        timestamp: 1,
      } as performanceUtils.DashboardInteractionMilestoneData);
      logger.onDashboardInteractionComplete({
        operationId,
        timestamp: 2,
        interactionType: 'refresh',
      } as performanceUtils.DashboardInteractionCompleteData);
    }

    for (let i = 0; i < 5; i++) {
      expect(clearMarksSpy).toHaveBeenCalledWith(
        PERFORMANCE_MARKS.DASHBOARD_MILESTONE(`op-${i}`, 'actual_interaction_complete')
      );
    }
  });
});
